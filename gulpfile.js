var gulp = require('gulp'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    derequire = require('gulp-derequire'),
    jsdoc = require('gulp-jsdoc'),
    meta = require('./package.json'),
    bundler;


// Browserify
bundler = browserify('./index.js', {'standalone': 'heimdallr-client'});
// add any other browserify options or transforms here
bundler.transform('brfs');

gulp.task('default', ['js', 'docs'], function(){
    // Hack because gulp wasn't exiting
    setTimeout(process.exit.bind(0));
});

gulp.task('js', function js() {
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
});

gulp.task('docs', function docs() {
    return gulp.src(['./lib/*.js', 'README.md'])
        .pipe(jsdoc.parser(meta))
        .pipe(jsdoc.generator(
            './docs',
            {
                path: 'ink-docstrap',
                systemName: 'Heimdallr Client',
                copyright: "©2015 Element Robot LLC",
                theme: 'spacelab',
                syntaxTheme: 'dark',
                linenums: true,
                dateFormat: 'YYYY-MM-DD'
            },
            {
                outputSourceFiles: false
            }
         ));
});
