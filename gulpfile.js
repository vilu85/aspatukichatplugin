var gulp = require('gulp');
// var uglify = require('gulp-uglify'); //<== Removed because it does not support ES6, use terser instead.
const terser = require('gulp-terser');
//var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var csso = require('gulp-csso');
var htmlmin = require('gulp-htmlmin');
var del = require('del');
//const babel = require('gulp-babel');

var jsSrc = './src/**/*.js';
var sassSrc = './src/**/*.scss';
var cssSrc = './src/**/*.css';
var htmlSrc = './src/**/*.html';

const AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

gulp.task('styles', function () {
  return gulp.src( cssSrc )
                // Auto-prefix css styles for cross browser compatibility
                //.pipe(autoprefixer({browsers: AUTOPREFIXER_BROWSERS}))
                .pipe(autoprefixer())
                // Minify the file
                .pipe(csso())
                // Output
                .pipe(gulp.dest('./build'));
});

gulp.task( 'scripts', function() {
  return  gulp.src( jsSrc )
                .pipe( terser() )
                .pipe( gulp.dest( './build' ) );
});

// Gulp task to minify HTML files
gulp.task('html', function() {
  return gulp.src( htmlSrc )
                .pipe(htmlmin({
                  collapseWhitespace: true,
                  removeComments: true
                }))
                .pipe(gulp.dest('./build'));
});

// gulp.task( 'styles', function() {
//   return  gulp.src( sassSrc )
//                 .pipe( sass( { outputStyle: 'compressed' } ) )
//                 .pipe( gulp.dest( './build/css' ) );
// });

gulp.task('zip', function () {
  return gulp.src('./build/**')
                .pipe( zip('AspaTukiChatPlugin.kpz') )
                .pipe(gulp.dest('./dist'));
});

var files = [
  './src/**/*.html',
  './src/**/*.js',
  './src/**/*.css',
  './src/**/*.png',
  './src/**/*.tt',
  './src/**/*.pm'
];
gulp.task('buildSources', function() {
  return gulp.src(files)
                .pipe(gulp.dest('./build'));
});

gulp.task( 'automate', function() {
  gulp.watch( [ jsSrc, cssSrc, htmlSrc ], [ 'scripts', 'styles', 'html' ] );
});

// Clean output directory
gulp.task('clean', () => del(['dist', 'build']));

// Gulp task to minify all files
gulp.task('minifyAll',gulp.series('styles','scripts','html'));
 
//gulp.task( 'default', ['scripts', 'styles', 'automate'] );
gulp.task('default',gulp.series('scripts','styles','html','automate'));

gulp.task( 'build', gulp.series( 'buildSources', 'minifyAll', 'zip' ));