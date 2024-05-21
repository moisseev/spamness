/* global ChromeUtils, libCommon, libExperiments, globalThis */
/* exported scoreColumn */

"use strict";

/* eslint-disable no-var */
var {ExtensionCommon} = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var {ExtensionSupport} = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
var [majorVersion, minorVersion] = Services.appinfo.platformVersion.split(".", 2).map((v) => parseInt(v, 10));
/* eslint-enable no-var */

const RspamdSpamnessColumn = {};
// Thunderbird Supernova with custom column handlers support
const SupernovaCC = majorVersion > 115 || (majorVersion === 115 && minorVersion >= 10);
const ThreadPaneColumns = SupernovaCC
    ? ChromeUtils.importESModule("chrome://messenger/content/thread-pane-columns.mjs").ThreadPaneColumns
    : null;

// eslint-disable-next-line no-var
var scoreColumn = class extends ExtensionCommon.ExtensionAPI {
    // eslint-disable-next-line class-methods-use-this
    onShutdown(isAppShutdown) {
        if (isAppShutdown) return;

        /*
         * A workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1634348
         * Probably the add-on will be updated. Invalidating the startup cache.
         */
        Services.obs.notifyObservers(null, "startupcache-invalidate");
    }

    getAPI(context) {
        const localStorage = {};

        const window = Services.wm.getMostRecentWindow("mail:3pane");

        const {ExtensionParent} =
            ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
        const extension = ExtensionParent.GlobalManager
            .getExtension("rspamd-spamness@alexander.moisseev");
        Services.scriptloader.loadSubScript(extension.getURL("scripts/libCommon.js"));
        Services.scriptloader.loadSubScript(extension.getURL("experiments/libExperiments.js"));

        RspamdSpamnessColumn.handler = {
            getCellProperties: function () {
                // Do nothing.
            },
            getCellText: function (row) {
                if (localStorage["display-column"] === "image")
                    return null;
                const score = RspamdSpamnessColumn.getScoreByRow(row);
                return (isNaN(score)) ? "" : score.toFixed(2);
            },
            getImageSrc: function (row) {
                if (localStorage["display-column"] === "text")
                    return null;
                const score = RspamdSpamnessColumn.getScoreByRow(row);
                if (localStorage["display-columnImageOnlyForPositive"] && score <= 0)
                    return null;
                return extension.getURL(libCommon.getImageSrc(score));
            },
            getRowProperties: function () {
                // Do nothing.
            },
            getSortLongForRow: function (hdr) {
                return libCommon.getScoreByHdr(hdr, localStorage.header, true) * 1e4 + 1e8;
            },
            getSortStringForRow: function () {
                return null;
            },
            isString: function () {
                return false;
            }
        };

        RspamdSpamnessColumn.getScoreByRow = function (row) {
            return libCommon.getScoreByHdr(window.gDBView.getMsgHdrAt(row), localStorage.header, true);
        };

        RspamdSpamnessColumn.dbObserver = {
            observe: function () {
                RspamdSpamnessColumn.addColumnHandler();
            }
        };

        RspamdSpamnessColumn.addColumnHandler = function () {
            window.gDBView.addColumnHandler("spamScoreCol", RspamdSpamnessColumn.handler);
        };

        context.callOnClose(this);
        return {
            scoreColumn: {
                getCharPref(prefName) {
                    return Services.prefs.getCharPref(prefName);
                },
                init() {
                    function getScore(hdr) {
                        const score = libCommon.getScoreByHdr(hdr, localStorage.header, true);
                        return (isNaN(score)) ? "" : score.toFixed(2);
                    }

                    function getImageId(hdr) {
                        const score = libCommon.getScoreByHdr(hdr, localStorage.header, true);
                        if (localStorage["display-columnImageOnlyForPositive"] && score <= 0)
                            return "";
                        return libCommon.getImageSrc(score, true);
                    }

                    function addCustomColumn(id, properties) {
                        ThreadPaneColumns.addCustomColumn(id, {
                            name: context.extension.localeData.localizeMessage("spamnessColumn.label"),
                            sortCallback: (hdr) => getScore(hdr) * 1e4 + 1e8,
                            sortable: true,
                            ...properties
                        });
                    }

                    if (SupernovaCC) {
                        const iconCellDefinitions = [];
                        [{alt: "H", name: "ham"}, {alt: "S", name: "spam"}].forEach((c) => {
                            for (let i = 0; i < 5; i++) {
                                iconCellDefinitions.push({
                                    alt: c.alt,
                                    id: c.name + i,
                                    title: c.name,
                                    url: extension.getURL("images/" + c.name + i + ".png")
                                });
                            }
                        });

                        addCustomColumn("spamIconCol", {
                            hidden: (localStorage["display-column"] === "text"),
                            icon: true,
                            iconCallback: getImageId,
                            iconCellDefinitions: iconCellDefinitions,
                            iconHeaderUrl: extension.getURL("images/icon12.svg"),
                            name: context.extension.localeData.localizeMessage("spamnessIconColumn.label"),
                            resizable: false,
                            textCallback: true
                        });

                        addCustomColumn("spamScoreCol", {
                            hidden: (localStorage["display-column"] === "image"),
                            name: context.extension.localeData.localizeMessage("spamnessColumn.label"),
                            textCallback: getScore
                        });

                        return;
                    }

                    if (majorVersion > 110) return;

                    // Listen for the main Thunderbird windows opening.
                    ExtensionSupport.registerWindowListener("scoreColumnListener", {
                        chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
                        onLoadWindow({document}) {
                            (function loadCSS() {
                                const href = extension.rootURI.resolve("experiments/scoreColumn.css");

                                const link = document.createElement("link");
                                link.id = "rspamd-spamness-messenger-css";
                                link.rel = "stylesheet";
                                link.href = href;

                                const referenceNode = document.getElementById("tabmail-container");
                                referenceNode.parentNode.insertBefore(link, referenceNode.previousSibling);
                            }());
                            (function addColumn() {
                                const columnId = "spamScoreCol";
                                if (document.getElementById(columnId)) return;

                                const treeCol = document.createXULElement("treecol");
                                treeCol.setAttribute("id", columnId);
                                treeCol.setAttribute("persist", "hidden ordinal sortDirection width");
                                treeCol.classList.add("headerValueBox");
                                treeCol.setAttribute("label", context.extension.localeData
                                    .localizeMessage("spamnessColumn.label"));
                                treeCol.setAttribute("tooltiptext", context.extension.localeData
                                    .localizeMessage("spamnessColumnToolTip.label"));
                                treeCol.setAttribute("width", "60px");

                                const threadCols = document.getElementById("threadCols");
                                threadCols.appendChild(treeCol);

                                // Restore persistent attributes. TB bug 1607575 and 1612055.
                                const attributes = Services.xulStore.getAttributeEnumerator(document.URL, columnId);
                                for (const attribute of attributes) {
                                    const value = Services.xulStore.getValue(document.URL, columnId, attribute);
                                    if (attribute === "ordinal") {
                                        treeCol.ordinal = value;
                                    } else {
                                        treeCol.setAttribute(attribute, value);
                                    }
                                }
                            }());

                            Services.obs.addObserver(RspamdSpamnessColumn.dbObserver, "MsgCreateDBView", false);

                            /*
                             * After add-on installation the observer misses the first notification
                             * since the window is already loaded.
                             */
                            Services.obs.notifyObservers(null, "MsgCreateDBView");
                        }
                    });
                },
                refreshCustomColumn(id) {
                    ThreadPaneColumns.refreshCustomColumn(id);
                },
                savePrefFile() {
                    Services.prefs.savePrefFile(null);
                },
                setCharPref(prefName, newPref) {
                    Services.prefs.setCharPref(prefName, newPref);
                },
                setLocalStorage(newSettings) {
                    for (const key in newSettings) {
                        if (newSettings[key] === null) delete newSettings[key];
                    }
                    Object.assign(localStorage, newSettings);
                }
            },
        };
    }

    // eslint-disable-next-line class-methods-use-this
    close() {
        if (SupernovaCC) {
            ["spamIconCol", "spamScoreCol"].forEach((c) => ThreadPaneColumns.removeCustomColumn(c));
            return;
        }

        if (majorVersion > 110) return;

        libExperiments.removeElements([
            "spamScoreCol",
            "rspamd-spamness-messenger-css"
        ]);
        Services.obs.removeObserver(RspamdSpamnessColumn.dbObserver, "MsgCreateDBView", false);
        ExtensionSupport.unregisterWindowListener("scoreColumnListener");
    }
};
