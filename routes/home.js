var express = require('express');
var router = express.Router();
var passport = require('../config/passport');
var fetch = require("node-fetch");
var async = require('async');

function apiCall(url) {
  return function(callback) {
    fetch(url)
    .then(function(res){
      return res.json();
    })
    .then(function(data) {
      return callback(null, data);
    })
    .catch(function(error){
      return callback(error);
    });
  };
}

// Home
router.get('/', function(req, res){

//  async.parallel({
//    posts: apiCall('http://localhost:3000/posts/getPosts')
//  }, function(err, results) {
//    if (err) console.log(err);
//    res.render("home/welcome", results);
//  });

  res.render('home/index');
});

router.get('/about', function(req, res){
  res.render('home/about');
});

// Login
router.get('/login', function (req,res) {
  var username = req.flash('username')[0];
  var errors = req.flash('errors')[0] || {};
  res.render('home/login', {
    username:username,
    errors:errors
  });
});

// Post Login
router.post('/login',
function(req,res,next){
  var errors = {};
  var isValid = true;

  if(!req.body.username){
    isValid = false;
    errors.username = 'Username is required!';
  }
  if(!req.body.password){
    isValid = false;
    errors.password = 'Password is required!';
  }

  if(isValid){
    next();
  }
  else {
    req.flash('errors',errors);
    res.redirect('/login');
  }
},
passport.authenticate('local-login', {
  successRedirect : '/',
  failureRedirect : '/login'
}
));

// Logout
router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

// Gallery
router.get('/gallery', function (req,res) {
  res.render('home/gallery');
});

module.exports = router;
