var gulp = require('gulp'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    derequire = require('gulp-derequire'),
    bundler;


// Browserify
bundler = browserify('./index.js', {'standalone': 'heimdallr-client'});
// add any other browserify options or transforms here
bundler.transform('brfs');

gulp.task('default', ['js'], function(){
    // Hack because gulp wasn't exiting
    setTimeout(process.exit.bind(0));
});
gulp.task('js', js);

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