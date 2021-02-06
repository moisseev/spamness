/* global browser, libBackground, messenger */

"use strict";

async function init() {
    const localStorage = await browser.storage.local.get();

    document.querySelector("#columnDisplay_" + localStorage["display-column"]).checked = true;
    document.querySelector("#columnImageOnlyForPositive").checked = localStorage["display-columnImageOnlyForPositive"];

    document.querySelector("#messageScore").checked = localStorage["display-messageScore"];
    document.querySelector("#messageRules").checked = localStorage["display-messageRules"];
    document.querySelector("#show_n_lines").value = localStorage["headers-show_n_lines"];
    document.querySelector("#colorizeSymbols").checked = localStorage["headers-colorizeSymbols"];

    document.querySelector("#trainingButtons-enabled").checked = localStorage["trainingButtons-enabled"];
    document.querySelector("#folderTrainHam").value = localStorage.folderTrainHam;
    document.querySelector("#folderTrainSpam").value = localStorage.folderTrainSpam;

    document.querySelector("#trainingButtonHamDefaultAction").value = localStorage["trainingButtonHam-defaultAction"];
    document.querySelector("#trainingButtonSpamDefaultAction").value = localStorage["trainingButtonSpam-defaultAction"];

    (async function populateSelect() {
        const select = document.getElementById("defaultTrainingFolderAccount");

        const unset = document.createElement("option");
        unset.value = "";
        unset.selected = true;
        select.appendChild(unset);

        (await messenger.runtime.getBackgroundPage()).browser.accounts.list().then((accounts) => {
            for (const account of accounts) {
                // Skip IM and RSS accounts
                const {type} = account;
                if (type === "im" || type === "rss") continue;

                const option = document.createElement("option");
                option.value = account.id;
                if (account.id === localStorage.defaultTrainingFolderAccount) option.selected = true;

                option.text = account.name;
                const {identities} = account;
                if (identities.length) {
                    // Get default identity (index = 0)
                    const [identity] = account.identities;
                    option.text += " - " + identity.name + " <" + identity.email + ">";
                }

                select.appendChild(option);
            }
        });
    })();
}

async function saveOptions(e) {
    e.preventDefault();

    const localStorage = await browser.storage.local.get();

    /* eslint-disable sort-keys */
    browser.storage.local.set({
        "display-column": document.querySelector("input[name='columnDisplay']:checked").value,
        "display-columnImageOnlyForPositive": document.querySelector("#columnImageOnlyForPositive").checked,

        "display-messageScore": document.querySelector("#messageScore").checked,
        "display-messageRules": document.querySelector("#messageRules").checked,
        "headers-show_n_lines": document.querySelector("#show_n_lines").value,
        "headers-colorizeSymbols": document.querySelector("#colorizeSymbols").checked,

        "trainingButtons-enabled": document.querySelector("#trainingButtons-enabled").checked,
        "defaultTrainingFolderAccount": document.getElementById("defaultTrainingFolderAccount").value,
        "folderTrainHam": document.querySelector("#folderTrainHam").value,
        "folderTrainSpam": document.querySelector("#folderTrainSpam").value,

        "trainingButtonHam-defaultAction": document.querySelector("#trainingButtonHamDefaultAction").value,
        "trainingButtonSpam-defaultAction": document.querySelector("#trainingButtonSpamDefaultAction").value
    });
    /* eslint-enable sort-keys */

    (await messenger.runtime.getBackgroundPage()).messenger.scoreColumn.setLocalStorage({
        "display-column": document.querySelector("input[name='columnDisplay']:checked").value,
        "display-columnImageOnlyForPositive": document.querySelector("#columnImageOnlyForPositive").checked
    });

    if (!localStorage["trainingButtons-enabled"] && document.querySelector("#trainingButtons-enabled").checked) {
        browser.runtime.sendMessage({method: "addTrainButtonsToNormalWindows"});
    } else if (localStorage["trainingButtons-enabled"] && !document.querySelector("#trainingButtons-enabled").checked) {
        (await messenger.runtime.getBackgroundPage()).messenger.trainButtons.removeButtons();
    }
}

document.querySelector("#account-options-button").addEventListener("click", function () {
    libBackground.createPopupWindow("/options/account-options.html", 891, 612);
});
document.querySelector("#advanced-options-button").addEventListener("click", function () {
    libBackground.createPopupWindow("/options/advancedOptions.html");
});
document.addEventListener("DOMContentLoaded", init);
document.querySelector("form").addEventListener("submit", saveOptions);
