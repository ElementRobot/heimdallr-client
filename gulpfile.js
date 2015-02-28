var gulp = require('gulp'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
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

gulp.task('docs', function docs(cb) {
    var destination = path.join('docs', meta.name, meta.version);

    // Unfortunately jsdoc doesn't fit well into the gulp paradigm since
    // it only provides a CLI tool.
    jsdocConf.opts.destination = destination;
    jsdocConfStr = JSON.stringify(jsdocConf, null, 2);
    fs.writeFileSync(jsdocConfPath, jsdocConfStr);
    exec('./node_modules/.bin/jsdoc -c ./docs/conf.json -p', function(err, stdout){
        if(stdout) console.log(stdout);
        if(err) return cb(err);
        cb();
    });

    // Update the github-pages redirect
    replace({
        regex: '\'.*\'',
        replacement: '\'' + destination + '/index.html\'',
        paths: ['index.html'],
        recurse: false,
        silent: true
    });
});


