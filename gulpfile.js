import path from "node:path";
import fs from "node:fs/promises";

import gulp from "gulp";
import { create as browserSyncCreate } from "browser-sync";
import { deleteAsync } from "del";
import versions from "gulp-version-number";
import rename from "gulp-rename";
import newer from "gulp-newer";
import through from "through2";

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

import imagemin, { gifsicle, mozjpeg, optipng, svgo } from "gulp-imagemin";
import imageminWebp from "imagemin-webp";

import ttf2woff from "gulp-ttf2woff";
import ttf2woff2 from "gulp-ttf2woff2";

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
    tailwindConfig: "./tailwind.config.ts",
    dest: "./dist/",
  },
  webp: {
    src: "./src/assets/img/**/*.{jpg,jpeg,png}",
    watch: "./src/assets/img/**/*.{jpg,jpeg,png}",
    dest: "./dist/assets/img/",
  },
  images: {
    src: "./src/assets/img/**/*.{gif,png,jpeg,jpg,svg}",
    watch: "./src/assets/img/**/*.{gif,png,jpeg,jpg,svg}",
    dest: "./dist/assets/img/",
  },
  fonts: {
    src: "./src/assets/fonts/**/*.ttf",
    watch: "./src/assets/fonts/**/*.ttf",
    dest: "./dist/assets/fonts/",
    localImports: "./src/styles/fonts.sass",
  },
  assets: {
    src: "./src/assets/**/*",
    watch: "./src/assets/**/*",
    dest: "./dist/assets/",
  },
};

let rollupCache;

function clean() {
  return deleteAsync("./dist/**", { force: true });
}

function cleanLocalFontImports() {
  return deleteAsync(paths.fonts.localImports, { force: true });
}

function watch() {
  browserSync.init({
    server: "./dist",
    open: false,
  });

  gulp.watch(paths.views.watch, gulp.parallel(views, styles));
  gulp.watch(paths.styles.watch, styles);
  gulp.watch(paths.styles.tailwindConfig, styles);
  gulp.watch(paths.scripts.watch, gulp.parallel(scripts, styles));
  gulp.watch(paths.webp.watch, webp);
  gulp.watch(paths.images.watch, images);
  gulp.watch(paths.fonts.watch, gulp.series(cleanLocalFontImports, fonts));
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
          to: [{ type: "js", files: ["main.min.js"] }, "css", "image"],
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
    .pipe(
      sass({
        outputStyle: "compressed",
        silenceDeprecations: ["legacy-js-api"],
        includePaths: ["node_modules"],
      }).on("error", sass.logError)
    )
    .pipe(
      postcss([
        tailwindcss("tailwind.config.ts"),
        autoprefixer(),
        cssnano(),
        cssImport(),
      ])
    )
    .pipe(rename({ basename: "styles", extname: ".css", suffix: ".min" }))
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(browserSync.stream());
}

const FontWeighMap = {
  Black: "900",
  ExtraBold: "800",
  Bold: "700",
  SemiBold: "600",
  Medium: "500",
  Regular: "400",
  Light: "300",
  ExtraLight: "200",
  Thin: "100",
};

function getFontWeight(spec) {
  for (const [key, weight] of Object.entries(FontWeighMap)) {
    if (spec.toLowerCase().trim().includes(key.toLowerCase().trim()))
      return weight;
  }

  return null;
}

function isFontItalic(spec) {
  return spec.toLowerCase().trim().includes("italic");
}

function fonts() {
  return gulp
    .src(paths.fonts.src, { encoding: false, removeBOM: false })
    .pipe(
      through.obj(async (chunk, enc, cb) => {
        const { name: filename } = path.parse(chunk.path);
        const [fontName, fontSpec] = filename.split("-");
        const weight = getFontWeight(fontSpec);
        const isItalic = isFontItalic(fontSpec);

        const data = `
          @font-face
            font-family: "${fontName}"
            src: url("/assets/fonts/${filename}.woff2") format("woff2"), url("/assets/fonts/${filename}.woff") format("woff")
            font-weight: ${weight ?? "normal"}
            font-style: ${isItalic ? "italic" : "normal"}
        `;

        await fs.writeFile("./src/styles/fonts.sass", data, { flag: "a+" });

        cb(null, chunk);
      })
    )
    .pipe(newer(paths.fonts.dest))
    .pipe(ttf2woff())
    .pipe(gulp.dest(paths.fonts.dest))
    .pipe(gulp.src(paths.fonts.src, { encoding: false, removeBOM: false }))
    .pipe(newer(paths.fonts.dest))
    .pipe(ttf2woff2())
    .pipe(gulp.dest(paths.fonts.dest))
    .pipe(browserSync.stream());
}

function webp() {
  return gulp
    .src(paths.webp.src, { encoding: false, removeBOM: false })
    .pipe(newer(paths.webp.dest))
    .pipe(imagemin([imageminWebp({ quality: 85 })], { verbose: true }))
    .pipe(rename({ extname: ".webp" }))
    .pipe(gulp.dest(paths.webp.dest))
    .pipe(browserSync.stream());
}

function images() {
  return (
    gulp
      .src(paths.images.src, {
        encoding: false,
        removeBOM: false,
      })
      .pipe(newer(paths.images.dest))
      // .pipe(
      //   imagemin(
      //     [
      //       gifsicle({ interlaced: true }),
      //       mozjpeg({ quality: 75, progressive: true }),
      //       optipng({ optimizationLevel: 5 }),
      //       svgo({
      //         plugins: [
      //           {
      //             name: "removeViewBox",
      //             active: true,
      //           },
      //           {
      //             name: "cleanupIDs",
      //             active: false,
      //           },
      //         ],
      //       }),
      //     ],
      //     {
      //       verbose: true,
      //     }
      //   )
      // )
      .pipe(gulp.dest(paths.images.dest))
      .pipe(browserSync.stream())
  );
}

gulp.task("default", watch);
gulp.task(
  "build",
  gulp.series(
    clean,
    cleanLocalFontImports,
    gulp.parallel(views, scripts, webp, images, gulp.series(fonts, styles))
  )
);
