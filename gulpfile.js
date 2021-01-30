const gulp = require('gulp');
// const uglify = require('gulp-uglify'); //<== Removed because it does not support ES6, use terser instead.
const terser = require('gulp-terser');
//const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const csso = require('gulp-csso');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const zip = require('gulp-zip');
const javascriptObfuscator = require('gulp-javascript-obfuscator');
const fs = require('fs');
const replace = require('gulp-replace');
//const bump = require('gulp-bump');
//const args = require('yargs').argv;
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

const type = {
  major : 1,
  minor : 2,
  patch : 3
};

gulp.task('styles', function () {
  return gulp.src( [cssSrc, '!*min.css'] )
                // Auto-prefix css styles for cross browser compatibility
                //.pipe(autoprefixer({browsers: AUTOPREFIXER_BROWSERS}))
                .pipe(autoprefixer())
                // Minify the file
                .pipe(csso())
                // Output
                .pipe(gulp.dest('./build'));
});

gulp.task( 'scripts', function() {
  return  gulp.src( [jsSrc, '!*min.js', '!./src/**/socket.io/**/*.js'] )
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
  './src/**/*.pm',
  './src/**/*.svg',
  './src/**/*.map',
  './src/**/*.inc'
];
gulp.task('buildSources', function() {
  return gulp.src(files)
                .pipe(gulp.dest('./build'));
});

gulp.task('obfuscate', function() {
  return gulp.src( jsSrc )
                .pipe(javascriptObfuscator())
                .pipe(gulp.dest('./build'));
});

gulp.task( 'automate', function() {
  gulp.watch( [ jsSrc, cssSrc, htmlSrc ], gulp.series('scripts', 'styles', 'html'));
});

// gulp.task('bump', function () {
//   /// <summary>
//   /// It bumps revisions
//   /// Usage:
//   /// 1. gulp bump : bumps the package.json and bower.json to the next minor revision.
//   ///   i.e. from 0.1.1 to 0.1.2
//   /// 2. gulp bump --version 1.1.1 : bumps/sets the package.json and bower.json to the 
//   ///    specified revision.
//   /// 3. gulp bump --type major       : bumps 1.0.0 
//   ///    gulp bump --type minor       : bumps 0.1.0
//   ///    gulp bump --type patch       : bumps 0.0.2
//   ///    gulp bump --type prerelease  : bumps 0.0.1-2
//   /// </summary>

//   var type = args.type;
//   var version = args.version;
//   var options = {};
//   if (version) {
//       options.version = version;
//       msg += ' to ' + version;
//   } else {
//       options.type = type;
//       msg += ' for a ' + type;
//   }

//   return gulp.src(['./package.json'])
//                 .pipe(bump(options))
//                 .pipe(gulp.dest('./'));
// });

gulp.task('bump major', () => {
  return bumpPerlFileVersion(type.major);
});

gulp.task('bump minor', () => {
  return bumpPerlFileVersion(type.minor);
});

gulp.task('bump patch', () => {
  return bumpPerlFileVersion(type.patch);
});

/**
 * Changes version number from Perl module
 * @param {type} opt Increment type, possible types: type.major, type.minor and type.patch
 */
function bumpPerlFileVersion(opt) {
  //docString is the file from which you will get your constant string
  var docString = fs.readFileSync('./src/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin.pm', 'utf8');

  //The code below gets your semantic v# from docString
  var versionNumPattern=/our \$VERSION = "(.*)"/; //This is just a regEx with a capture group for version number
  var vNumRexEx = new RegExp(versionNumPattern);
  var oldVersionNumber = (vNumRexEx.exec(docString))[1]; //This gets the captured group

  //...Split the version number string into elements so you can bump the one you want
  var versionParts = oldVersionNumber.split('.');
  var vArray = {
      vMajor : versionParts[0],
      vMinor : versionParts[1],
      vPatch : versionParts[2]
  };

  opt = opt || {};  
  switch (opt) {
    case type.major:
      vArray.vMajor = parseFloat(vArray.vMajor) + 1;
      vArray.vMinor = 0;
      vArray.vPatch = 0;
      break;
    case type.minor:
      vArray.vMinor = parseFloat(vArray.vMinor) + 1;
      vArray.vPatch = 0;
      break;
    case type.patch:
      vArray.vPatch = parseFloat(vArray.vPatch) + 1;
      break;
    default:
      console.error("Version increment type %d was missing!", opt);
      return false;
  }

  var periodString = ".";

  var newVersionNumber = vArray.vMajor + periodString +
                         vArray.vMinor + periodString +
                         vArray.vPatch;

  console.info("Changing perl module version %s -> %s", oldVersionNumber, newVersionNumber);
  const date = new Date();
  var dateString = date.getFullYear() + '-' +
    (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
    date.getDate().toString().padStart(2, '0');

  return gulp.src(['./src/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin.pm'])
      .pipe(replace(/our \$VERSION = "(.*)"/g, 'our $VERSION = "' + newVersionNumber + '"'))
      .pipe(replace(/our \$DATE_UPDATED = "(.*)"/g, 'our $DATE_UPDATED = "' + dateString + '"'))
      .pipe(gulp.dest('./src/Koha/Plugin/Com/Honkaportaali/'));
}

// Clean output directory
gulp.task('clean', () => del(['dist', 'build']));

// Gulp task to minify all files
gulp.task('minifyAll',gulp.series('styles','scripts','html'));
 
//gulp.task( 'default', ['scripts', 'styles', 'automate'] );
gulp.task('default',gulp.series('scripts','styles','html','automate'));

gulp.task( 'build source zip', gulp.series( 'clean', 'bump patch', 'buildSources', 'minifyAll', 'zip' ));

gulp.task( 'build', gulp.series( 'clean', 'bump minor', 'buildSources', 'minifyAll', 'zip' ));

gulp.task( 'build minor', gulp.series( 'clean', 'bump minor', 'buildSources', 'minifyAll', 'zip' ));

gulp.task( 'build patch', gulp.series( 'clean', 'bump patch', 'buildSources', 'minifyAll', 'zip' ));

gulp.task( 'build release', gulp.series( 'clean', 'bump minor', 'buildSources', 'minifyAll', 'obfuscate', 'zip' ));