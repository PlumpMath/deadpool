// deadpool.me -- client

Meteor.subscribe("directory");
Meteor.subscribe("deadpool");

// If no deceased selected, select one.
Meteor.startup(function () {
  Deps.autorun(function () {
    if (! Session.get("selected")) {
      var deceased = Deadpool.findOne();
      if (deceased)
        Session.set("selected", deceased._id);
    }
  });
});

///////////////////////////////////////////////////////////////////////////////
// Deceased details sidebar

/*
Template.details.deceased = function () {
  return Deadpool.findOne(Session.get("selected"));
};
*/

Template.details.anyDeadpool = function () {
  return Deadpool.find().count() > 0;
};

Template.details.creatorName = function () {
  var owner = Meteor.users.findOne(this.owner);
  if (owner._id === Meteor.userId())
    return "me";
  return displayName(owner);
};

Template.details.canRemove = function () {
  return this.owner === Meteor.userId() && attending(this) === 0;
};

Template.details.maybeChosen = function (what) {
  var myRemember = _.find(this.remembers, function (r) {
    return r.user === Meteor.userId();
  }) || {};

  return what == myRemember.remember ? "chosen btn-inverse" : "";
};

Template.details.events({
  'click .remember_small': function () {
    Meteor.call("remember", this._id, "small");
    return false;
  },
  'click .remember_large': function () {
    Meteor.call("remember", this._id, "large");
    return false;
  },
  'click .remember_medium': function () {
    Meteor.call("remember", this._id, "medium");
    return false;
  },
  'click .invite': function () {
    openInviteDialog();
    return false;
  },
  'click .remove': function () {
    Deadpool.remove(this._id);
    return false;
  }
});

///////////////////////////////////////////////////////////////////////////////
// Deceased remembrance widget

Template.remembrance.rememberName = function () {
  var user = Meteor.users.findOne(this.user);
  return displayName(user);
};

Template.remembrance.outstandingInvitations = function () {
  var deceased = Deadpool.findOne(this._id);
  return Meteor.users.find({$and: [
    {_id: {$in: deceased.invited}}, // they're invited
    {_id: {$nin: _.pluck(deceased.remembers, 'user')}} // but haven't RSVP'd
  ]});
};

Template.remembrance.invitationName = function () {
  return displayName(this);
};

Template.remembrance.rememberIs = function (what) {
  return this.remember === what;
};

Template.remembrance.nobody = function () {
  return ! this.public && (this.remembers.length + this.invited.length === 0);
};

Template.remembrance.canInvite = function () {
  return ! this.public && this.owner === Meteor.userId();
};

///////////////////////////////////////////////////////////////////////////////
// Map display

/*
// Use jquery to get the position clicked relative to the map element.
var coordsRelativeToElement = function (element, event) {
  var offset = $(element).offset();
  var x = event.pageX - offset.left;
  var y = event.pageY - offset.top;
  return { x: x, y: y };
};

Template.map.events({
  'mousedown circle, mousedown text': function (event, template) {
    Session.set("selected", event.currentTarget.id);
  },
  'dblclick .map': function (event, template) {
    if (! Meteor.userId()) // must be logged in to create events
      return;
    var coords = coordsRelativeToElement(event.currentTarget, event);
    openCreateDialog(coords.x / 500, coords.y / 500);
  }
});

Template.map.rendered = function () {
  var self = this;
  self.node = self.find("svg");

  if (! self.handle) {
    self.handle = Deps.autorun(function () {
      var selected = Session.get('selected');
      var selectedDeceased = selected && Deadpool.findOne(selected);
      var radius = function (deceased) {
        return 10 + Math.sqrt(attending(deceased)) * 10;
      };

      // Draw a circle for each deceased
      var updateCircles = function (group) {
        group.attr("id", function (deceased) { return deceased._id; })
        .attr("cx", function (deceased) { return deceased.x * 500; })
        .attr("cy", function (deceased) { return deceased.y * 500; })
        .attr("r", radius)
        .attr("class", function (deceased) {
          return deceased.public ? "public" : "private";
        })
        .style('opacity', function (deceased) {
          return selected === deceased._id ? 1 : 0.6;
        });
      };

      var circles = d3.select(self.node).select(".circles").selectAll("circle")
        .data(Deadpool.find().fetch(), function (deceased) { return deceased._id; });

      updateCircles(circles.enter().append("circle"));
      updateCircles(circles.transition().duration(250).ease("cubic-out"));
      circles.exit().transition().duration(250).attr("r", 0).remove();

      // Label each with the current remembrance count
      var updateLabels = function (group) {
        group.attr("id", function (deceased) { return deceased._id; })
        .text(function (deceased) {return attending(deceased) || '';})
        .attr("x", function (deceased) { return deceased.x * 500; })
        .attr("y", function (deceased) { return deceased.y * 500 + radius(deceased)/2 })
        .style('font-size', function (deceased) {
          return radius(deceased) * 1.25 + "px";
        });
      };

      var labels = d3.select(self.node).select(".labels").selectAll("text")
        .data(Deadpool.find().fetch(), function (deceased) { return deceased._id; });

      updateLabels(labels.enter().append("text"));
      updateLabels(labels.transition().duration(250).ease("cubic-out"));
      labels.exit().remove();

      // Draw a dashed circle around the currently selected deceased, if any
      var callout = d3.select(self.node).select("circle.callout")
        .transition().duration(250).ease("cubic-out");
      if (selectedDeceased)
        callout.attr("cx", selectedDeceased.x * 500)
        .attr("cy", selectedDeceased.y * 500)
        .attr("r", radius(selectedDeceased) + 10)
        .attr("class", "callout")
        .attr("display", '');
      else
        callout.attr("display", 'none');
    });
  }
};

Template.map.destroyed = function () {
  this.handle && this.handle.stop();
};
*/
///////////////////////////////////////////////////////////////////////////////
// Create Deceased dialog

var openCreateDialog = function (x, y) {
  Session.set("createCoords", {x: x, y: y});
  Session.set("createError", null);
  Session.set("showCreateDialog", true);
};

Template.page.showCreateDialog = function () {
  return Session.get("showCreateDialog");
};

Template.createDialog.events({
  'click .save': function (event, template) {
    var title = template.find(".title").value;
    var description = template.find(".description").value;
    var public = true; // ! template.find(".private").checked;
    var coords = {x: 0, y: 0}; // TODO get coords from map, if map.

    if (title.length && description.length) {
      Meteor.call('createDeceased', {
        title: title,
        description: description,
        x: coords.x,
        y: coords.y,
        public: public
      }, function (error, deceased) {
        if (! error) {
          Session.set("selected", deceased); // useful if created via map
          if (! public && Meteor.users.find().count() > 1)
            openInviteDialog();
        }
      });
      Session.set("showCreateDialog", false);
    } else {
      Session.set("createError",
                  "It needs a title and a description, or why bother?");
    }
  },

  'click .cancel': function () {
    Session.set("showCreateDialog", false);
  }
});

Template.createDialog.error = function () {
  return Session.get("createError");
};

////////
Template.page.events({
	'click #addNew': function(event, template) {
		if (! Meteor.userId()) // must be logged in to create events
			return;
		openCreateDialog(500, 500);
	}
});

///////////////////////////////////////////////////////////////////////////////
// Invite dialog

var openInviteDialog = function () {
  Session.set("showInviteDialog", true);
};

Template.page.showInviteDialog = function () {
  return Session.get("showInviteDialog");
};

Template.details.score = function() {
	var score = _.reduce(this.remembers || [], function(accum, o) {
		if (o.remember === "small") {
			return 1 + accum;
		} else if (o.remember === "medium") {
			return 10 + accum;
		} else if (o.remember === "large") {
			return 100 + accum;
		}
	}, 0);
	return score;
};

Template.inviteDialog.events({
  'click .invite': function (event, template) {
    Meteor.call('invite', Session.get("selected"), this._id);
  },
  'click .done': function (event, template) {
    Session.set("showInviteDialog", false);
    return false;
  }
});

Template.inviteDialog.uninvited = function () {
  var deceased = Deadpool.findOne(Session.get("selected"));
  if (! deceased)
    return []; // deceased hasn't loaded yet
  return Meteor.users.find({$nor: [{_id: {$in: deceased.invited}},
                                   {_id: deceased.owner}]});
};

Template.inviteDialog.displayName = function () {
  return displayName(this);
};

/////////// listings

Template.startups.startups  = function() {
	//var items = Deadpool.find();
	//console.log("Number of startups " + items.count());
	//return items;
	return Deadpool.find({}, {sort: {updated: -1}});
};
