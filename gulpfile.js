"use strict";

var gulp = require('gulp'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
    mocha = require('gulp-mocha'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    derequire = require('gulp-derequire'),
    fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    replace = require('replace'),
    meta = require('./package.json'),
    jsdocConfPath = './docs/conf.json',
    jsdocConf = require(jsdocConfPath),
    bundler;


// Browserify
bundler = browserify('./lib/heimdallr-client.js', {'standalone': 'heimdallr-client'});
// add any other browserify options or transforms here
bundler.transform('brfs');

gulp.task('default', ['tests', 'build', 'docs'], function () {
    // Hack because gulp wasn't exiting
    setTimeout(process.exit.bind(0));
});

gulp.task('tests', function tests() {
    return gulp.src('./tests/test.js', {read: false})
        .pipe(mocha());
});

gulp.task('build', ['tests'], function build() {
    return bundler.bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))  // log errors if they happen
        .pipe(source('heimdallr-client.js'))
        .pipe(derequire())
        .pipe(buffer())
        .pipe(gulp.dest('./build'))  // write the original file
        .pipe(rename({suffix: '.min'}))
        .pipe(sourcemaps.init({loadMaps: true}))  // loads map from browserify file
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))  // writes .map file
        .pipe(gulp.dest('./build'));
});

gulp.task('docs', ['tests'], function docs(cb) {
    var destination = path.join('docs', meta.name, meta.version),
        jsdocConfStr;

    // Unfortunately jsdoc doesn't fit well into the gulp paradigm since
    // it only provides a CLI tool.
    jsdocConf.opts.destination = destination;
    jsdocConfStr = JSON.stringify(jsdocConf, null, 2);
    fs.writeFile(jsdocConfPath, jsdocConfStr, function () {
        exec(
            './node_modules/.bin/jsdoc -c ./docs/conf.json -u ./examples -p',
            function (err, stdout) {
                if (stdout) {
                    console.log(stdout);
                }
                if (err) {
                    return cb(err);
                }
                cb();
            }
        );

        // Update the github-pages redirect
        replace({
            regex: '\'.*\'',
            replacement: '\'' + destination + '/index.html\'',
            paths: ['index.html'],
            recurse: false,
            silent: true
        });
    });
});

gulp.watch(['./lib', 'README.md'], ['default']);



