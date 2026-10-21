// Which parts of the original (pre-split) app.js became on-demand files. Used by tools/analyze-chunks.js on a monolithic
// app.js only; once split, the source of truth is the js/*.js files plus the generated registry block inside app.js.
module.exports = {
  chunks: {
    suppliers: [[11091, 12940]],
    analytics: [[8779, 9467], [14979, 99999]],
    staff:     [[7746, 8093]],
    expenses:  [[8094, 8778]],
    attendance:[[9468, 9978], [13964, 14195]],
    audit:     [[9979, 10542]],
    users:     [[10658, 10898]],
    telegram:  [[14527, 14965]],
    recipes:   [[13790, 13963]],
  },
};
