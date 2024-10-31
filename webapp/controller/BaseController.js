sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/ws/SapPcpWebSocket",
], function (Controller, UIComponent, SapPcpWebSocket) {
    "use strict";

    var TQAModel;

    return Controller.extend("managebays.controller.BaseController", {
        getModelTQA: function () {
            return TQAModel;
        },

        setModelTQA: function (token) {
            var userLanguage = sessionStorage.getItem("oLangu");
            if (!userLanguage) {
                userLanguage = "EN";
            }
            var serviceUrlWithLanguage = this.getModel().sServiceUrl + (this.getModel().sServiceUrl.includes("?") ? "&" : "?") + "sap-language=" + userLanguage;

            TQAModel = new sap.ui.model.odata.v2.ODataModel({
                serviceUrl: serviceUrlWithLanguage,
                annotationURI: "/zsrv_iwfnd/Annotations(TechnicalName='%2FTQA%2FOD_MANAGE_BAYS_QUE_ANNO_MDL',Version='0001')/$value/",
                headers: {
                    "authorization": token,
                    "applicationName": "MANAGE_BAYS"
                }
            });

            this.setModel(TQAModel);
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        onNavBack: function () {
            sessionStorage.setItem("goToLaunchpad", "X");
        },

        onNavigation: function (sPath, oRoute, oEntityName) {
            if (sPath) {
                this.getRouter().navTo(oRoute, {
                    objectId: sPath.replace(oEntityName, "")
                }, true);
            } else {
                this.getRouter().navTo(oRoute, {}, true);
            }
        },

        onObjectMatched: function (oEvent) {
            this.onBindView("/" + oEvent.getParameter("config").pattern.replace("/{objectId}", "") + oEvent.getParameter("arguments").objectId);
        },

        onBindView: function (sObjectPath) {
            this.getView().bindElement({
                path: sObjectPath,
                change: this.onBindingChange.bind(this),
                events: {
                    dataRequested: function () {
                        this.getModel("appView").setProperty("/busy", true);
                    }.bind(this),
                    dataReceived: function () {
                        this.getModel("appView").setProperty("/busy", false);
                    }.bind(this)
                }
            });
        },

        onBindingChange: function () {
            var oView = this.getView(),
                oElementBinding = oView.getElementBinding();

            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("notFound");

                return;
            }
        },

        showSuccessMessage: function (oMessage) {
            new sap.m.MessageBox.success(this.getResourceBundle().getText(oMessage.oText), {
                title: this.getResourceBundle().getText(oMessage.oTitle),
                actions: [sap.m.MessageBox.Action.OK],
                emphasizedAction: sap.m.MessageBox.Action.OK,
            });
        },

        onValueHelp: function (oInput) {
            var sPath = "/xTQAxEQUIPMENTS_VH",
                sTitle = "Equipamentos Disponíveis",
                sItemTitle = "{eqktx}",
                sItemKey = "{status}",
                sFilter = "eqktx";

            if (oInput.includes("motorista")) {
                sPath = "/xTQAxDRIVERS_VH";
                sTitle = "Motoristas Disponíveis";
                sItemTitle = "{name}";
                sItemKey = "{usrid}";
                sFilter = "name"
            }

            if (!this.oDefaultDialog) {
                this.oDefaultDialog = new sap.m.SelectDialog({
                    id: "globalVh",
                    title: sTitle,
                    multiSelect: false,
                    rememberSelections: true,
                    selectionChange: this._onChangeValueHelp.bind(this, oInput),
                    search: this._onSearchValueHelp.bind(this, sFilter),
                    items: {
                        path: sPath,
                        template: new sap.m.StandardListItem({
                            title: sItemTitle,
                            description: sItemKey
                        })
                    },
                });

                this.getView().addDependent(this.oDefaultDialog);
                this.oDefaultDialog.open();
            } else {
                this.oDefaultDialog.destroy();

                this.oDefaultDialog = new sap.m.SelectDialog({
                    id: "globalVh",
                    title: sTitle,
                    multiSelect: false,
                    rememberSelections: true,
                    selectionChange: this._onChangeValueHelp.bind(this, oInput),
                    search: this._onSearchValueHelp.bind(this, sFilter),
                    items: {
                        path: sPath,
                        template: new sap.m.StandardListItem({
                            title: sItemTitle,
                            description: sItemKey
                        })
                    },
                });

                this.getView().addDependent(this.oDefaultDialog);
                this.oDefaultDialog.open();
            }
        },

        _onSearchValueHelp: function (sFilter, oEntityProperties) {
            var sValue = oEntityProperties.getParameter("value"),
                oFilter = new sap.ui.model.Filter(sFilter, sap.ui.model.FilterOperator.Contains, sValue),
                oBinding = oEntityProperties.getSource().getBinding("items");

            oBinding.filter([oFilter]);
        },

        _onChangeValueHelp: function (oInput, oEntityProperties) {
            var oSelectedItem = oEntityProperties.mParameters.listItem.mProperties;
            if (oSelectedItem) {
                if (!oInput.includes("motorista")) {
                    var sSelectedKey = oSelectedItem.title;
                } else {
                    var sSelectedKey = oSelectedItem.description;
                }

                var oInput = sap.ui.getCore().byId(oInput);
                if (oInput) {
                    oInput.setValue(sSelectedKey);
                }
            }
        },

        onDestroyDialog: function (oDialog) {
            if (this[oDialog]) {
                this[oDialog].close();
                this[oDialog].destroy();
                this[oDialog] = null;
            }
        },

        onZoom: function (oZoom, oProcessFlow) {
            switch (oZoom) {
                case 'In':
                    this.byId(oProcessFlow).zoomIn();
                    break;
                case 'Out':
                    this.byId(oProcessFlow).zoomOut();
                    break;
            }
        },

        onStartWebSocket: function () {
            var that = this,
                socket, webSocketURI,
                tokenUser = "TQA_UPDATE";

            // webSocketURI = "wss://sapdev.grupornm.pt:44300" + '/sap/bc/apc/tqa/trace';
            webSocketURI = "wss://sap.grupornm.pt:44300" + '/sap/bc/apc/tqa/trace';

            socket = new WebSocket(webSocketURI);
            socket.onerror = function (error) {
                console.error("WebSocket Error: ", error);
            };

            socket.onopen = function () {
                socket.send(JSON.stringify({ token: tokenUser }));
            };

            socket.onmessage = function (notification) {
                switch (notification.data) {
                    case "TRACE":
                        that.onGetTrace();
                        break;
                    case "Trace":
                        that.onGetTrace();
                        break;
                    case "BAYS":
                        that.onGetBays();
                        break;
                    case "Bays":
                        that.onGetBays();
                        break;
                    case "QUEUE":
                        that.onGetQueue(true);
                        break;
                    case "Queue":
                        that.onGetQueue(true);
                        break;
                    case "GLOBAL":
                        that.onGetQueue(true);
                        that.onGetTrace();
                        break;
                    case "Global":
                        that.onGetQueue(true);
                        that.onGetTrace();
                        break;
                }
            };
        },

        getUserAuthentication: function (type) {
            var that = this,
                urlParams = new URLSearchParams(window.location.search),
                token = urlParams.get('token');

            if (token != null) {
                var headers = new Headers();
                headers.append("X-authorization", token);

                var requestOptions = {
                    method: 'GET',
                    headers: headers,
                    redirect: 'follow'
                };

                fetch("/sap/opu/odata/TQA/AUTHENTICATOR_SRV/USER_AUTHENTICATION", requestOptions)
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error("Ocorreu um erro ao ler a entidade.");
                        }
                        return response.text();
                    })
                    .then(function (xml) {
                        var parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xml, "text/xml"),
                            successResponseElement = xmlDoc.getElementsByTagName("d:SuccessResponse")[0],
                            response = successResponseElement.textContent;

                        if (response != 'X') {
                            that.getRouter().navTo("NotFound");
                        }
                        else {
                            that.getModel("appView").setProperty("/token", token);
                        }
                    })
                    .catch(function (error) {
                        console.error(error);
                    });
            } else {
                that.getRouter().navTo("NotFound");
                return;
            }
        },


    });
});