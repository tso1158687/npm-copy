var RegClient,
  _,
  fibrous,
  fs,
  path,
  indexOf =
    [].indexOf ||
    function(item) {
      for (var i = 0, l = this.length; i < l; i++) {
        if (i in this && this[i] === item) return i;
      }
      return -1;
    };

path = require("path");

fs = require("fs");

fibrous = require("fibrous");

RegClient = require("npm-registry-client");

_ = require("lodash");

module.exports = fibrous(function(argv) {
  var dir,
    dist,
    e,
    from,
    fromVersions,
    i,
    k,
    len,
    moduleName,
    moduleNames,
    newMetadata,
    npm,
    oldMetadata,
    publishUrl,
    ref,
    ref1,
    remoteTarball,
    res,
    results,
    semver,
    to,
    toVersions,
    v,
    versionsToSync;
  (ref = (function() {
    var i, len, ref, results;
    ref = ["to", "from"];
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      dir = ref[i];
      results.push({
        url: argv[dir],
        host: argv[dir + "-host"],
        auth: {
          token: argv[dir + "-token"],
          username: argv[dir + "-username"],
          password: argv[dir + "-password"],
          email: argv[dir + "-email"],
          alwaysAuth: true
        }
      });
    }
    return results;
  })()),
    (to = ref[0]),
    (from = ref[1]);
  moduleNames = argv._;
  if (
    !(
      from.url &&
      (from.auth.token || (from.auth.username && from.auth.password)) &&
      to.url &&
      (to.auth.token || (to.auth.username && to.auth.password)) &&
      moduleNames.length
    )
  ) {
    console.log(
      "usage: npm-copy --from <repository url> --from-token <token> --to <repository url> --to-token <token> moduleA [moduleB...]"
    );
    return;
  }
  npm = new RegClient();
  ref1 = argv._;
  results = [];
  for (i = 0, len = ref1.length; i < len; i++) {
    moduleName = ref1[i];
    fromVersions = npm.sync.get(from.url + "/" + moduleName, {
      auth: from.auth,
      timeout: 3000
    }).versions;
    try {
      toVersions = npm.sync.get(to.url + "/" + moduleName, {
        auth: to.auth,
        timeout: 3000
      }).versions;
    } catch (error) {
      e = error;
      if (e.code !== "E404") {
        throw e;
      }
      toVersions = {};
    }
    versionsToSync = _.difference(
      Object.keys(fromVersions),
      Object.keys(toVersions)
    );
    results.push(
      (function() {
        var results1;
        results1 = [];
        for (semver in fromVersions) {
          oldMetadata = fromVersions[semver];
          if (indexOf.call(versionsToSync, semver) < 0) {
            console.log(
              moduleName + "@" + semver + " already exists on destination"
            );
            continue;
          }
          dist = oldMetadata.dist;
          newMetadata = {};
          for (k in oldMetadata) {
            v = oldMetadata[k];
            if (k[0] !== "_" && k !== "dist") {
              newMetadata[k] = v;
            }
          }
          remoteTarball = npm.sync.fetch(dist.tarball, {
            auth: from.auth
          });
          try {
            if (to.host === "verdaccio") {
              publishUrl = to.url;
            } else {
              publishUrl = to.url + "/" + moduleName;
            }
            res = npm.sync.publish("" + publishUrl, {
              auth: to.auth,
              metadata: newMetadata,
              access: "public",
              body: remoteTarball
            });
            results1.push(console.log(moduleName + "@" + semver + " cloned"));
          } catch (error) {
            e = error;
            remoteTarball.connection.end();
            if (e.code !== "EPUBLISHCONFLICT") {
              throw e;
            }
            results1.push(
              console.warn(
                moduleName +
                  "@" +
                  semver +
                  " already exists on the destination, skipping."
              )
            );
          }
        }
        return results1;
      })()
    );
  }
  return results;
});
