import gulp from "gulp";
import { create as browserSyncCreate } from "browser-sync";
import { deleteAsync } from "del";
import versions from "gulp-version-number";
import rename from "gulp-rename";

import pug from "gulp-pug";

import * as dartSass from "sass";
import gulpSass from "gulp-sass";
import postcss from "gulp-postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import tailwindcss from "tailwindcss";
import cssImport from "postcss-import";

import source from "vinyl-source-stream";
import buffer from "vinyl-buffer";
import rollup from "@rollup/stream";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const isDev = process.env.NODE_ENV === "development";

const browserSync = browserSyncCreate();

const sass = gulpSass(dartSass);

const paths = {
  views: {
    src: ["./src/views/index.pug", "./src/views/pages/*.pug"],
    watch: "./src/**/*.pug",
    dest: "./dist/",
  },
  scripts: {
    src: "./src/scripts/main.ts",
    watch: "./src/**/*.{js,ts}",
    dest: "./dist/",
  },
  styles: {
    src: "./src/styles/globals.{css,sass,scss}",
    watch: "./src/**/*.{css,sass,scss}",
    dest: "./dist/",
  },
};

let rollupCache;

function clean() {
  return deleteAsync("./dist/**", { force: true });
}

function watch() {
  browserSync.init({
    server: "./dist",
  });

  gulp.watch(paths.views.watch, gulp.parallel(views, styles));
  gulp.watch(paths.styles.watch, styles);
  gulp.watch(paths.scripts.watch, gulp.parallel(scripts, styles));
}

function views() {
  return gulp
    .src(paths.views.src)
    .pipe(pug())
    .pipe(
      versions({
        value: "%MDS%",
        append: {
          key: "v",
          to: ["js", "css"],
        },
      })
    )
    .pipe(gulp.dest(paths.views.dest))
    .pipe(browserSync.stream());
}

function scripts() {
  return rollup({
    input: paths.scripts.src,
    plugins: [
      babel({ babelHelpers: "bundled" }),
      commonjs(),
      nodeResolve(),
      typescript(),
      terser(),
    ],
    cache: rollupCache,
    output: {
      format: "iife",
    },
  })
    .on("bundle", (bundle) => (rollupCache = bundle))
    .pipe(source("main.min.js"))
    .pipe(buffer())
    .pipe(gulp.dest(paths.scripts.dest))
    .pipe(browserSync.stream());
}

function styles() {
  return gulp
    .src(paths.styles.src)
    .pipe(sass({ outputStyle: "compressed" }).on("error", sass.logError))
    .pipe(
      postcss([
        tailwindcss("tailwind.config.js"),
        autoprefixer(),
        cssnano(),
        cssImport(),
      ])
    )
    .pipe(rename({ basename: "styles", extname: ".css", suffix: ".min" }))
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(browserSync.stream());
}

gulp.task("test", styles);

gulp.task("default", watch);
