"use strict";

RspamdSpamness.Message = {};

RspamdSpamness.Message.displayHeaders = function() {
    const prefs = Services.prefs;

    var id = {
        score: {
            hdr: {
                score: {
                    icon:  "rspamdSpamnessScoreIcon",
                    score: "rspamdSpamnessScoreHeader"
                },
                bayes: {
                    icon:  "rspamdSpamnessBayesIcon",
                    score: "rspamdSpamnessBayesHeader"
                },
                fuzzy: {
                    icon:  "rspamdSpamnessFuzzyIcon",
                    score: "rspamdSpamnessFuzzyHeader"
                }
            }
        }
    };

    var el = {
        greyl: {
            row: getEl("expandedRspamdSpamnessGreylistRow"),
            hdr: getEl("expandedRspamdSpamnessGreylistHeader")
        },
        score: {
            row: getEl("expandedRspamdSpamnessRow")
        },
        rules: {
            row: getEl("expandedRspamdSpamnessRulesRow"),
            box: getEl("expandedRspamdSpamnessRulesBox")
        }
    };

    var show = {
        greyl: getPref("extensions.rspamd-spamness.display.messageGreylist"),
        score: getPref("extensions.rspamd-spamness.display.messageScore"),
        rules: getPref("extensions.rspamd-spamness.display.messageRules")
    };

    function getEl(id) {
        return document.getElementById(id);
    }

    function getPref(prefName) {
        try {
            return prefs.getBoolPref(prefName);
        } catch (e) {
            RspamdSpamness.err(e);
        }
    }

    el.greyl.row.collapsed = true;
    el.score.row.collapsed = true;
    el.rules.row.collapsed = true;

    if (show.greyl) {
        const msg = gMessageDisplay.displayedMessage;
        if (msg.folder) {
            MsgHdrToMimeMessage(msg, null, function(aMsgHdr, aMimeMsg) {
                const greylistHeaders = getGreylistHeaders(aMimeMsg.headers);
                el.greyl.row.collapsed = (greylistHeaders.length == 0);
                el.greyl.hdr.headerValue = greylistHeaders;
                el.greyl.hdr.valid = true;
            }, true);
        };
    }

    function getGreylistHeaders(msgHeaders) {
        let greylistHeaders = [];
        if ('x-rmilter-greylist' in msgHeaders) {
            msgHeaders['x-rmilter-greylist'].forEach(function(header) {
                if (header != null)
                    greylistHeaders.push(header);
            });
        }
        return greylistHeaders;
    };

    if (!show.score && !show.rules)
        return;

    if (gDBView.msgFolder == null)
        return;

    var hdr = gDBView.msgFolder.GetMessageHeader(gDBView.getKeyAt(gDBView.currentlyDisplayedMessage));

    if (!hdr)
        return;

    var headerStr = RspamdSpamness.getHeaderStr(hdr);
    if (headerStr == null)
        return null;

    var match = headerStr.match(/: False \[([-\d\.]+) \/ [-\d\.]+\] *(.*)$/);
    if (match == null)
        return null;

    if (show.score) {
        var parsed = [];
        parsed.score = parseFloat(match[1]);
        el.score.row.collapsed = (parsed.score == null);

        if (parsed.score == null) {
            el.score.score.headerValue = "";
            return;
        }

        var match1 = headerStr.match(/BAYES_(HAM|SPAM)\(([-\d\.]+)\)/);
        parsed.bayes = (match1)
            ? parseFloat(match1[2])
            :"undefined";

        var re = /FUZZY_(?:WHITE|PROB|DENIED|UNKNOWN)\(([-\d\.]+)\)/g;
        var fuzzySymbols = [];
        parsed.fuzzy = 0;
        var fuzzySymbolsCount = 0;
        while ((fuzzySymbols = re.exec(headerStr)) != null) {
            parsed.fuzzy += parseFloat(fuzzySymbols[1]);
            fuzzySymbolsCount++;
        }
        parsed.fuzzy = (parsed.fuzzy)
            ? +parseFloat(parsed.fuzzy).toFixed(10)
            : "undefined";

        var fuzzyCounter = (fuzzySymbolsCount > 1)
            ? "{" + fuzzySymbolsCount + "}"
            : "";

        var hdrVal = {
            score: parsed.score + " ( Bayes:",
            bayes: parsed.bayes + ", Fuzzy" + fuzzyCounter + ":",
            fuzzy: parsed.fuzzy + " )"
        };

        for (var key in id.score.hdr) {
            getEl(id.score.hdr[key].icon).src = RspamdSpamness.getImageSrc(parsed[key]);
            getEl(id.score.hdr[key].score).headerValue = hdrVal[key];
        }
    }

    if (show.rules) {
        if (el.rules.box.clearHeaderValues)
            el.rules.box.clearHeaderValues();

        var rules = [];
        if (match[2] != "") {
            rules = match[2].split(/ /);
        }

        el.rules.row.collapsed = (rules.length == 0);
        if (rules.length > 0) {
            for (var i = 0; i < rules.length; i++) {
                var link = {};
                link.displayText = rules[i];
                link.class = RspamdSpamness.getMetricClass(rules[i]);
                el.rules.box.addLinkView(link);
            }
            el.rules.box.buildViews();
        }
    }
};

RspamdSpamness.Message.onLoad = function() {
    var listener = {};
    listener.onStartHeaders = function() {};
    listener.onEndHeaders = function() {
        RspamdSpamness.Message.displayHeaders();
    };
    gMessageListeners.push(listener);
};

RspamdSpamness.Message.onUnload = function() {
    window.removeEventListener("load", RspamdSpamness.Message.onLoad, false);
    window.removeEventListener("unload", RspamdSpamness.Message.onUnload, false);
};

window.addEventListener("load", RspamdSpamness.Message.onLoad, false);
window.addEventListener("unload", RspamdSpamness.Message.onUnload, false);
