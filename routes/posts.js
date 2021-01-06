var express  = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({ dest: 'uploadedFiles/' });
var Post = require('../models/Post');
var User = require('../models/User');
var Comment = require('../models/Comment');
var File = require('../models/File');
var Board = require('../models/Board');
var util = require('../util');
var fs = require('fs');

// Index
router.get('/',function(req, res){
  res.render('posts/index')
});

// Board
router.get('/:board', async function(req, res){
  var page = Math.max(1, parseInt(req.query.page));
  var limit = Math.max(1, parseInt(req.query.limit));
  page = !isNaN(page)?page:1;
  limit = !isNaN(limit)?limit:10;

  var skip = (page-1)*limit;
  var maxPage = 0;
  var searchQuery = await createSearchQuery(req.query);
  var posts = [];

  var board = await checkBoardAndReturn(req.params.board);
  if(!board) {
    return res.json('\''+req.params.board + '\' 은(는) 존재하지 않는 게시판입니다.');
  }

  if(searchQuery) {
    var count = await Post.countDocuments({ '$and': [searchQuery, {board: {$in:[board._id]}}]});
    maxPage = Math.ceil(count/limit);
    posts = await Post.aggregate([
      { $match: searchQuery },
      { $match: { board: board._id }},
      { $lookup: {
          from: 'boards',
          localField: 'board',
          foreignField: 'board',
          as: 'board'
      } },
      { $unwind: {
        path: '$board',
        preserveNullAndEmptyArrays: true
      } },
      { $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
      } },
      { $unwind: '$author' },
      { $sort : { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'post',
          as: 'comments'
      } },
      { $lookup: {
          from: 'files',
          localField: 'attachment',
          foreignField: '_id',
          as: 'attachment'
      } },
      { $unwind: {
        path: '$attachment',
        preserveNullAndEmptyArrays: true
      } },
      { $project: {
          title: 1,
          author: {
            username: 1,
          },
          views: 1,
          numId: 1,
          attachment: { $cond: [{$and: ['$attachment', {$not: '$attachment.isDeleted'}]}, true, false] },
          createdAt: 1,
          commentCount: { $size: '$comments'}
      } },
    ]).exec();
  }

  res.render('posts/board', {
    posts:posts,
    currentPage:page,
    maxPage:maxPage,
    limit:limit,
    searchType:req.query.searchType,
    searchText:req.query.searchText,
    board:board
  });
});

// New
router.get('/:board/new', util.isLoggedin, async function(req, res){
  var board = await checkBoardAndReturn(req.params.board);
  if(!board) {
    return res.status(404).json('\'' + req.params.board + '\' 은(는) 존재하지 않는 게시판입니다.');
  }
  var post = req.flash('post')[0] || {};
  var errors = req.flash('errors')[0] || {};
  res.render('posts/new', { post:post, errors:errors, board:board });
});

// create
router.post('/:board', util.isLoggedin, upload.single('attachment'), async function(req, res){
  var board = await checkBoardAndReturn(req.params.board);
  if(!board) {
    return res.redirect('/posts/new/'+req.params.board);
  }
  var attachment = req.file?await File.createNewInstance(req.file, req.user._id):undefined;
  req.body.attachment = attachment;
  req.body.author = req.user._id;
  req.body.board = board._id;
  Post.create(req.body, function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/'+req.params.board+'/new'+res.locals.getPostQueryString());
    }
    if(attachment){
      attachment.postId = post._id;
      attachment.save();
    }
    res.redirect('/posts/'+req.params.board+res.locals.getPostQueryString(false, { page:1, searchText:'' }));
  });
});

// show
router.get('/:board/:id', async function(req, res){
  var board = await checkBoardAndReturn(req.params.board);
  if(!board) {
    return res.json('\''+req.params.board + '\' 은(는) 존재하지 않는 게시판입니다.');
  }
  var commentForm = req.flash('commentForm')[0] || { _id: null, form: {} };
  var commentError = req.flash('commentError')[0] || { _id:null, parentComment: null, errors:{}}; //1

  Promise.all([
      Post.findOne({_id:req.params.id}).populate({ path: 'author', select: 'username' }).populate({ path: 'board' }).populate({path: 'attachment',match:{isDeleted:false}}),
      Comment.find({post:req.params.id}).sort('createdAt').populate({ path: 'author', select: 'username', populate: { path: 'rank'} })
    ])
    .then(([post, comments]) => {
      if(!post) return res.status(404).json('The post you are looking for deos not exist.');
      var commentTrees = util.convertToTrees(comments, '_id','parentComment','childComments');                               //2
      res.render('posts/show', { post:post, commentTrees:commentTrees, commentForm:commentForm, commentError:commentError}); //2
    })
    .catch((err) => {
      return res.json(err);
    });
});

// edit
router.get('/:board/:id/edit', util.isLoggedin, checkPermission, function(req, res){
  var post = req.flash('post')[0];
  var errors = req.flash('errors')[0] || {};
  if(!post){
    Post.findOne({_id:req.params.id})
      .populate({path:'attachment',match:{isDeleted:false}})
      .populate({ path: 'board' })
      .exec(function(err, post){
        if(err) return res.json(err);
        res.render('posts/edit', { post:post, errors:errors });
      });
  }
  else {
    post._id = req.params.id;
    res.render('posts/edit', { post:post, errors:errors });
  }
});

// update
router.put('/:board/:id', util.isLoggedin, checkPermission, upload.single('newAttachment'), async function(req, res){
  var board = await checkBoardAndReturn(req.params.board);
  if(!board) {
    return res.json('\''+req.params.board + '\' 은(는) 존재하지 않는 게시판입니다.');
  }
  var post = await Post.findOne({_id:req.params.id}).populate({path:'attachment',match:{isDeleted:false}}).populate({ path: 'board' });
  if(post.attachment && (req.file || !req.body.attachment)){
    var fileLink = './uploadedFiles/' + post.attachment.serverFileName;
    fs.stat(fileLink , function(err, stats) {
      if(err) return console.error(err);
      fs.unlinkSync(fileLink,function(err){
        if(err) return console.log(err);
      });
    });
    post.attachment.processDelete();
  }
  req.body.attachment = req.file?await File.createNewInstance(req.file, req.user._id, req.params.id):post.attachment;
  req.body.updatedAt = Date.now();
  Post.findOneAndUpdate({_id:req.params.id},
    req.body,
    {runValidators:true}
  )
  .populate({ path: 'board' })
  .exec(function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/'+req.params.board+'/'+req.params.id+'/edit'+res.locals.getPostQueryString());
    }
    res.redirect('/posts/'+post.board.name+'/'+req.params.id+res.locals.getPostQueryString());
  });
});

// destroy
router.delete('/:board/:id', util.isLoggedin, checkPermission, async function(req, res){
  var post = await Post.findOne({_id:req.params.id}).populate({path:'attachment',match:{isDeleted:false}}).populate({ path: 'board' });
  if(post.attachment) {
    var fileLink = './uploadedFiles/' + post.attachment.serverFileName;
    fs.stat(fileLink , function(err, stats) {
      if(err) return console.error(err);
      fs.unlinkSync(fileLink,function(err){
        if(err) return console.log(err);
      });
    });
    post.attachment.processDelete();
  }
  Post.deleteOne({_id:req.params.id}, function(err){
    if(err) return res.json(err);
    res.redirect('/posts/'+post.board.name+'/'+res.locals.getPostQueryString());
  });
});

module.exports = router;

// private functions
function checkPermission(req, res, next){
  Post.findOne({_id:req.params.id}, function(err, post){
    if(err) return res.json(err);
    if(post.author != req.user.id) return util.noPermission(req, res);

    next();
  });
}

async function createSearchQuery(queries){
  var searchQuery = {};
  if(queries.searchType && queries.searchText && queries.searchText.length >= 3){
    var searchTypes = queries.searchType.toLowerCase().split(',');
    var postQueries = [];
    if(searchTypes.indexOf('title')>=0){
      postQueries.push({ title: { $regex: new RegExp(queries.searchText, 'i') } });
    }
    if(searchTypes.indexOf('body')>=0){
      postQueries.push({ body: { $regex: new RegExp(queries.searchText, 'i') } });
    }
    if(searchTypes.indexOf('author!')>=0){
      var user = await User.findOne({ username: queries.searchText }).exec();
      if(user) postQueries.push({author:user._id});
    }
    else if(searchTypes.indexOf('author')>=0){
      var users = await User.find({ username: { $regex: new RegExp(queries.searchText, 'i') } }).exec();
      var userIds = [];
      for(var user of users){
        userIds.push(user._id);
      }
      if(userIds.length>0) postQueries.push({author:{$in:userIds}});
    }
    if(postQueries.length>0) searchQuery = {$or:postQueries};
    else searchQuery = null;
  }
  return searchQuery;
}

async function checkBoardAndReturn(boardName){
  var board = await Board.findOne({ name: boardName })
  return board;
}
