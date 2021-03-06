const $ = require('jquery');
const Assets = require('./asset_manager');
const AudioPlayer = require('./audio_player');

var Game = function(canvas, context) {
  this.size = { x: canvas.width, y: canvas.height };
  this.assets = new Assets({ x: this.size.x, y: this.size.y });
  this.difficulty = 0.001;
  this.playing = false;
  this.gameOver = false;
  this.backgroundObjects = [this.assets.randomBackgroundObject(null, this.difficulty)];
  this.jeepney = this.assets.jeepney();
  this.obstacles = [this.assets.obstacle('streetDog', this.difficulty)];
  this.background = this.assets.background('ground');
  this.clouds = [this.assets.background('cloud')];
  this.bonuses = [];
  this.audio = new AudioPlayer({ source: 'assets/audio/lupang_hinirang.mp3', loops: true, volume: 0.3 });

  var gameAnimation = function() {
    if (this.playing) {
      this.update();
      this.draw(context);
      requestAnimationFrame(gameAnimation);
    } else {
      requestAnimationFrame(gameAnimation);
      this.endGame(context);
    }
  }.bind(this);

  gameAnimation();
};

Game.prototype.startUp = function(){
  this.playing = true;
  this.jeepney.driveAudio.play();
  this.audio.play();
  setInterval(this.generateBonusObjects.bind(this), 5000);
};

Game.prototype.update = function() {
  var jeepney = this.jeepney;
  this.difficulty += 0.001;
  this.generateBackgroundObjects();
  this.generateObstacles();
  this.generateClouds();
  this.set(this.backgroundObjects);
  this.set(this.clouds);
  this.setObstacles(jeepney);
  this.setBonusObjects();

  jeepney.update();

  this.checkJeepneyHealth();
};

Game.prototype.generateClouds = function() {
  var firstCloud = this.clouds[0];
  var lastCloud = this.clouds[this.clouds.length - 1];

  if (firstCloud.x < 0 - firstCloud.width) {
    this.clouds.shift();
  } else if (lastCloud.x + lastCloud.width < this.size.x - Math.random() * 5000 - 40) {
    this.clouds.push(this.assets.background('cloud'));
  }
};

Game.prototype.generateBackgroundObjects = function() {
  var firstBackgroundObject = this.backgroundObjects[0];
  var lastBackgroundObject = this.backgroundObjects[this.backgroundObjects.length - 1];

  if (firstBackgroundObject.x < 0 - firstBackgroundObject.width) {
    this.backgroundObjects.shift();
  } else if (lastBackgroundObject.x + lastBackgroundObject.width < this.size.x - Math.random() * 50 - 10) {
    this.backgroundObjects.push(this.assets.randomBackgroundObject(lastBackgroundObject, this.difficulty));
  }
};

Game.prototype.generateBonusObjects = function() {
  var bonus = this.bonuses[0];
  var offScreen = bonus ? bonus.x + bonus.width < 0 || bonus.y + bonus.height < 0 : null;

  if (!bonus) {
    this.bonuses.push(this.assets.randomBonusObject(this.difficulty));
  } else if (offScreen) {
    this.bonuses.shift();
  }
};

Game.prototype.set = function(objects) {
  for (let i = 0; i < objects.length; i++) {
    objects[i].update();
  }
};

Game.prototype.setBonusObjects = function() {
  var validBonusObjects = this.bonuses.filter(function(bonusItem){
    return !bonusItem.hitByJeepney;
  });

  var collectedBonuses = this.bonuses.filter(function(bonusItem){
    return bonusItem.hitByJeepney;
  });

  for (let i = 0; i < validBonusObjects.length; i++) {
    if (this.jeepney.isColliding(validBonusObjects[i])) {
      validBonusObjects[i].processColission(this.jeepney);
      this.jeepney.collectBonus();
    }
    validBonusObjects[i].update();
  }

  for (let i = 0; i < collectedBonuses.length; i++) {
    collectedBonuses[i].update();
  }
};

Game.prototype.generateObstacles = function() {
  var firstObstacle = this.obstacles[0];
  var lastObstacle = this.obstacles[this.obstacles.length - 1];
  var minDistanceBetweenObstacles = this.size.x - Math.random() * 5000 - this.jeepney.width * 2;

  if (!firstObstacle || lastObstacle.x + lastObstacle.width < minDistanceBetweenObstacles) {
    var newObstacle = this.difficulty > 1 ? this.assets.randomObstacle(this.difficulty) : this.assets.obstacle('streetDog', this.difficulty);
    this.obstacles.push(newObstacle);
  } else if (
    firstObstacle.x + firstObstacle.width < 0 ||
    firstObstacle.x > this.size.x ||
    firstObstacle.y > this.size.y
  ) {
    this.obstacles.shift();
  }
};

Game.prototype.setObstacles = function(jeepney) {
  var validObstacles = this.obstacles.filter(function(obstacle) {
    return !obstacle.hitByJeepney;
  });
  var hitObstacles = this.obstacles.filter(function(obstacle) {
    return obstacle.hitByJeepney;
  });

  for (let i = 0; i < validObstacles.length; i++) {
    if (jeepney.isColliding(validObstacles[i])) {
      jeepney.loseHealth();
      validObstacles[i].processColission(jeepney);
    }
    validObstacles[i].update();
  }

  for (let i = 0; i < hitObstacles.length; i++) {
    hitObstacles[i].update();
  }
};

Game.prototype.checkJeepneyHealth = function() {
  if (this.jeepney.isDead()) {
    localStorage.lastScore = this.jeepney.score;
    this.gameOver = true;
    this.playing = false;
  }
};

Game.prototype.endGame = function(context) {
  this.playing = false;
  this.jeepney.driveAudio.stop();
  this.audio.stop();
  context.clearRect(0, 0, this.size.x, this.size.y);
  this.drawStart(context);
  if (!localStorage.highScore || this.jeepney.score > localStorage.highScore) {
    localStorage.highScore = this.jeepney.score;
    $('#high-score').text(this.jeepney.score);
  }
};

Game.prototype.draw = function(context) {
  context.clearRect(0, 0, this.size.x, this.size.y);
  context.fillStyle = "darkGray";
  context.fillRect(0, 300, this.size.x, 65);
  this.background.draw(context);
  this.drawAsset(this.clouds, context);
  this.drawAsset(this.backgroundObjects, context);
  this.jeepney.draw(context);
  this.drawAsset(this.obstacles, context);
  this.drawAsset(this.bonuses, context);
  this.drawScore(context);
  this.drawHealth(context);
};

Game.prototype.drawAsset = function(objects, context) {
  for (let i = 0; i < objects.length; i++) {
    objects[i].draw(context);
  }
};

Game.prototype.drawScore = function(context) {
  context.font = '30px VT323';
  context.fillStyle = 'black';
  context.fillText("Score: " + this.jeepney.score, 50, 48);
};

Game.prototype.drawLastScore = function(context) {
  var numHighScoreChars = localStorage.lastScore.split('').length;
  context.font = '50px VT323';
  context.fillStyle = 'black';
  context.fillText("Last Score: " + localStorage.lastScore, this.size.x / 2 - ((11 + numHighScoreChars) * 11), 75);
  let img = new Image();
  img.src = 'assets/images/restart.png';
  context.drawImage(img, 1, 1, 898, 398);
};

Game.prototype.drawHealth = function(context) {
  var x = 825;
  for (var i = 0; i < this.jeepney.health; i++) {
    var img = new Image();
    img.src = 'assets/images/heart.png';
    context.drawImage(img, x, 25, 30, 30);
    x -= 45;
  }
};

Game.prototype.drawStart = function(context){
  if (this.gameOver) {
    this.drawLastScore(context);
  } else {
    let img = new Image();
    img.src = 'assets/images/start.png';
    context.drawImage(img, 1, 1, 898, 398);
  }
};
module.exports = Game;
