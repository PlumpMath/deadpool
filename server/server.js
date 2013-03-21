// deadpool.me -- server

Meteor.publish("directory", function () {
  return Meteor.users.find({}, {fields: {emails: 1, profile: 1}});
});

Meteor.publish("deadpool", function () {
  return Deadpool.find(
    {$or: [{"public": true}, {invited: this.userId}, {owner: this.userId}]});
});
