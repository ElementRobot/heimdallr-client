var gulp = require('gulp'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    watchify = require('watchify'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    derequire = require('gulp-derequire'),
    browserifyArgs = {'standalone': 'heimdallr-client'},
    bundler;


// Browserify
if(process.env.DEV){
    console.warn('WARN: Local paths will be included in build');
    for(var key in watchify.args){
        // Add in watchify args
        browserifyArgs[key] = watchify.args[key];
    }
}
bundler = watchify(browserify('./index.js', browserifyArgs));
// add any other browserify options or transforms here
bundler.transform('brfs');

gulp.task('default', ['js'], function(){
    // Hack because gulp wasn't exiting
    setTimeout(process.exit.bind(0));
});
gulp.task('js', js);
bundler.on('update', js); // on any dep update, runs the bundler

function js() {
  return bundler.bundle()
    // log errors if they happen
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('heimdallr-client.js'))
    .pipe(derequire())
    .pipe(buffer())
    .pipe(gulp.dest('./build'))
    .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
    .pipe(uglify())
    .pipe(sourcemaps.write('./')) // writes .map file
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('./build'));
}