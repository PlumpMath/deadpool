// deadpool.me -- data model
// Loaded on both the client and the server

///////////////////////////////////////////////////////////////////////////////
// Deadpool

/*
  Each deceased is represented by a document in the Deadpool collection:
    owner: user id
    x, y: Number (screen coordinates in the interval [0, 1])
    title, description: String
    public: Boolean
    invited: Array of user id's that invited to pay remembrance to this dead startup (only if !public)
    remembers: Array of objects like {user: userId, remember: "small"} (or "medium"/"large")
	created: time when added to system
	updated: time when updated.
*/
Deadpool = new Meteor.Collection("deadpool");

Deadpool.allow({
  insert: function (userId, deceased) {
    return false; // no cowboy inserts -- use createDeceased method
  },
  update: function (userId, deceased, fields, modifier) {
    if (userId !== deceased.owner)
      return false; // not the owner

    var allowed = ["title", "description", "x", "y"];
    if (_.difference(fields, allowed).length)
      return false; // tried to write to forbidden field

    // A good improvement would be to validate the type of the new
    // value of the field (and if a string, the length.) In the
    // future Meteor will have a schema system to makes that easier.
    return true;
  },
  remove: function (userId, deceased) {
    // You can only remove deadpool that you created and nobody is going to.
    return deceased.owner === userId && attending(deceased) === 0;
  }
});

var attending = function (deceased) {
  return true; //(_.groupBy(deceased.remembers, 'remember').small || []).length;
};

Meteor.methods({
  // options should include: title, description, x, y, public
  createDeceased: function (options) {
    options = options || {};
    if (! (typeof options.title === "string" && options.title.length &&
           typeof options.description === "string" &&
           options.description.length &&
           typeof options.x === "number" && options.x >= 0 && options.x <= 1 &&
           typeof options.y === "number" && options.y >= 0 && options.y <= 1))
      throw new Meteor.Error(400, "Required parameter missing");
    if (options.title.length > 100)
      throw new Meteor.Error(413, "Title too long");
    if (options.description.length > 1000)
      throw new Meteor.Error(413, "Description too long");
    if (! this.userId)
      throw new Meteor.Error(403, "You must be logged in");

    return Deadpool.insert({
      owner: this.userId,
      x: options.x,
      y: options.y,
      title: options.title,
      description: options.description,
      public: !! options.public,
	  created: (new Date()).getTime(),
      updated: (new Date()).getTime(),
      invited: [],
      remembers: []
    });
  },

  invite: function (deceasedId, userId) {
    var deceased = Deadpool.findOne(deceasedId);
    if (! deceased || deceased.owner !== this.userId)
      throw new Meteor.Error(404, "No such deceased");
    if (deceased.public)
      throw new Meteor.Error(400,
                             "That deceased is public. No need to invite people.");
    if (userId !== deceased.owner && ! _.contains(deceased.invited, userId)) {
      Deadpool.update(deceasedId, { $addToSet: { invited: userId } });

      var from = contactEmail(Meteor.users.findOne(this.userId));
      var to = contactEmail(Meteor.users.findOne(userId));
      if (Meteor.isServer && to) {
        // This code only runs on the server. If you didn't want clients
        // to be able to see it, you could move it to a separate file.
        Email.send({
          from: "deadpool@meetstrange.com",
          to: to,
          replyTo: from || undefined,
          subject: "Remembrance: " + deceased.title,
          text:
"Hey, I just invited you to remember '" + deceased.title + "' on deadpool.me." +
"\n\nYour remembrance will be appreciated: " + Meteor.absoluteUrl() + "\n"
        });
      }
    }
  },

  remember: function (deceasedId, remember) {
    if (! this.userId)
      throw new Meteor.Error(403, "You must be logged in to remember");
    if (! _.contains(['small', 'medium', 'large'], remember))
      throw new Meteor.Error(400, "Invalid remembrance");
    var deceased = Deadpool.findOne(deceasedId);
    if (! deceased)
      throw new Meteor.Error(404, "No such deceased");
    if (! deceased.public && deceased.owner !== this.userId &&
        !_.contains(deceased.invited, this.userId))
      // private, but let's not tell this to the user
      throw new Meteor.Error(403, "No such deceased");

    var rememberIndex = _.indexOf(_.pluck(deceased.remembers, 'user'), this.userId);
    if (rememberIndex !== -1) {
      // update existing remember entry

      if (Meteor.isServer) {
        // update the appropriate remember entry with $
        Deadpool.update(
          {_id: deceasedId, "remembers.user": this.userId},
          {$set: {"remembers.$.remember": remember}});
      } else {
        // minimongo doesn't yet support $ in modifier. as a temporary
        // workaround, make a modifier that uses an index. this is
        // safe on the client since there's only one thread.
        var modifier = {$set: {}};
        modifier.$set["remembers." + rememberIndex + ".remember"] = remember;
        Deadpool.update(deceasedId, modifier);
      }

      // Possible improvement: send email to the other people that are
      // coming to the deceased.
    } else {
      // add new remember entry
      Deadpool.update(deceasedId,
                     {$push: {remembers: {user: this.userId, remember: remember, updated: (new Date()).getTime()}}});
    }
  }
});

///////////////////////////////////////////////////////////////////////////////
// Users

var displayName = function (user) {
  if (user.profile && user.profile.name)
    return user.profile.name;
  return user.emails[0].address;
};

var contactEmail = function (user) {
  if (user.emails && user.emails.length)
    return user.emails[0].address;
  if (user.services && user.services.facebook && user.services.facebook.email)
    return user.services.facebook.email;
  return null;
};
