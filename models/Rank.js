var mongoose = require('mongoose');

// schema
var rankSchema = mongoose.Schema({
  name:{type:String},
  perms:{type:String},
  display:{type:String}
});

// model & export
var Rank = mongoose.model('rank', rankSchema);
module.exports = Rank;