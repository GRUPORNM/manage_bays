sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "managebays/model/models",
    "./controller/ErrorHandler"
],
    function (UIComponent, Device, models, ErrorHandler) {
        "use strict";

        return UIComponent.extend("managebays.Component", {
            metadata: {
                manifest: "json"
            },

            init: function () {
                UIComponent.prototype.init.apply(this, arguments);

                this._oErrorHandler = new ErrorHandler(this);

                this.getRouter().initialize();
                this.setModel(models.createDeviceModel(), "device");
                this.setModel(models.createGlobalModel(), "global");

            },

            destroy: function () {
                this._oErrorHandler.destroy();

                UIComponent.prototype.destroy.apply(this, arguments);
            },
        });
    }
);