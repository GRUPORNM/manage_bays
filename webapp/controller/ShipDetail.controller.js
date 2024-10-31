sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/m/MessageBox",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Filter",
],
    function (BaseController, JSONModel, formatter, MessageBox, FilterOperator, Filter) {
        "use strict";

        return BaseController.extend("managebays.controller.ShipDetail", {

            formatter: formatter,

            onInit: function () {
                var oTraceModel = new JSONModel({
                    nodes: [],
                }),
                    oShipmentDetails = new JSONModel({
                        items: [],
                    }),
                    oTerminalData = new JSONModel({
                        items: [],
                        modifications: []
                    });

                this.setModel(oShipmentDetails, "ShipmentDetails");
                this.setModel(oTraceModel, "Trace");
                this.setModel(oTerminalData, "TerminalData");
                sessionStorage.setItem("goToLaunchpad", "");

                sap.ui.core.UIComponent.getRouterFor(this).getRoute("shipsdetail").attachPatternMatched(this.onPatternMatched, this);
            },

            onAfterRendering: function () {
                var that = this;
                sessionStorage.setItem("goToLaunchpad", "");
                window.addEventListener("message", function (event) {
                    var data = event.data;
                    if (data.action == "goToMainPage") {
                        that.onNavBackDetail();
                    }
                });
            },

            onPatternMatched: function (oEvent) {
                this.onBindViewDetail("/" + oEvent.getParameter("config").pattern.replace("/{objectId}", "") + oEvent.getParameter("arguments").objectId, true);
            },

            onBindViewDetail: function (sObjectPath, bForceRefresh) {
                var that = this;
                sessionStorage.setItem("goToLaunchpad", "");

                this.getView().bindElement({
                    path: sObjectPath,
                    change: this.onBindingChange.bind(this),
                    events: {
                        dataRequested: function () {
                        }.bind(this),
                        dataReceived: function () {
                            that.onTraceLoad(sObjectPath);
                            that.onGetAttachments();
                        }.bind(this)
                    }
                });

                if (bForceRefresh) {
                    this.getView().getModel().refresh();
                }
            },

            onTraceLoad: function (sObjectPath) {
                var oModel = this.getModel(),
                    that = this;

                sObjectPath = sObjectPath + "/to_ShipsTrace";

                oModel.read(sObjectPath, {
                    success: function (oData) {
                        that.getModel("TerminalData").setData(oData);
                        that.onBuildTrace(oData.results);
                        that.onBindModifications(oData.results);
                    }
                });
            },

            onBindModifications: function (aResults) {
                var aModifications = [],
                    that = this;

                if (aResults.length > 0) {
                    aResults.forEach(function (oSelectedData) {
                        if (oSelectedData.mod_logs) {
                            try {
                                var oModifications = JSON.parse(oSelectedData.mod_logs);
                                if (oModifications) {

                                    for (var sState in oModifications) {
                                        if (oModifications.hasOwnProperty(sState)) {
                                            var oActions = oModifications[sState];

                                            for (var sAction in oActions) {
                                                if (oActions.hasOwnProperty(sAction) && !sAction.endsWith("_T")) {
                                                    var sActionTimestamp = sAction + "_T",
                                                        sTimestamp = oActions[sActionTimestamp] || null,
                                                        sUser = oActions[sAction];

                                                    if (sUser !== "0" && sTimestamp !== "0") {
                                                        aModifications.push({
                                                            Action: sAction,
                                                            User: sUser,
                                                            Timestamp: sTimestamp
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                // that.byId("modificationsSection").setVisible(false);
                                // that.byId("modificationsTable").setVisible(false);
                            }
                        }
                    });

                    if (aModifications.length > 0) {
                        // this.byId("modificationsSection").setVisible(true);
                        // this.byId("modificationsTable").setVisible(true);
                        this.getModel("TerminalData").setProperty("/modifications", aModifications);
                    }
                }
            },

            onGetAttachments: function (sObjectPath) {
                var oObject = this.getView().getBindingContext().getObject(),
                    oModel = this.getModel(),
                    that = this;

                oModel.read("/GetAttachments", {
                    filters: [
                        new Filter("Tknum", FilterOperator.EQ, oObject.tknum)
                    ],
                    success: function (oData) {
                        var sAttachments = JSON.parse(oData.results[0].Attachment);
                        sAttachments = sAttachments.filter(item => item.VBELN !== "")

                        that.getModel("ShipmentDetails").setProperty("/items", sAttachments);

                        var oTable = that.byId("ShipsLoads"),
                            aItems = oTable.getItems();

                        aItems.forEach(function (oItem) {
                            oItem.setType("Active");
                        });
                    }
                });
            },

            onBuildTrace: function (oResults) {
                var that = this;
                if (this.byId("processflow").getNodes().length > 0) {
                    this.byId("processflow").destroyNodes();
                    this.getModel("Trace").setData({ nodes: [] });
                }

                var fieldDescriptions = {
                    "incheckin": { description: this.getResourceBundle().getText("checkIn"), abbreviation: "CI" },
                    "infe": { description: this.getResourceBundle().getText("queue"), abbreviation: "FE" },
                    "incall": { description: this.getResourceBundle().getText("call"), abbreviation: "CH" },
                    "ingobay": { description: this.getResourceBundle().getText("queue"), abbreviation: "II" },
                    "inbay": { description: this.getResourceBundle().getText("bays"), abbreviation: "NI" },
                    "inloading": { description: this.getResourceBundle().getText("loading"), abbreviation: "AC" },
                    "inleavebay": { description: this.getResourceBundle().getText("exitBay"), abbreviation: "SI" },
                    "incheckout": { description: this.getResourceBundle().getText("checkOut"), abbreviation: "CO" },
                    "inleave": { description: this.getResourceBundle().getText("exitTerminal"), abbreviation: "ST" },
                };

                function countFilledFields(result) {
                    var fields = ['incheckin', 'infe', 'incall', 'ingobay', 'inbay', 'inloading', 'inleavebay', 'incheckout', 'inleave'];
                    return fields.reduce(function (count, field) {
                        return result[field] ? count - 1 : count;
                    }, 0);
                }

                function getStatePriority(state) {
                    switch (state) {
                        case 'E': return 1;
                        case 'W': return 2;
                        case 'S': return 3;
                        case 'P': return 4;
                        default: return 5;
                    }
                }

                if (oResults) {
                    var sortedResults = oResults.sort(function (a, b) {
                        var aPriority = Math.min.apply(null, ['Incheckin', 'Infe', 'Incall', 'Ingobay', 'Inbay', 'Inloading', 'Inleavebay', 'Incheckout', 'Inleave'].map(function (field) {
                            return getStatePriority(a[field]);
                        }));
                        var bPriority = Math.min.apply(null, ['Incheckin', 'Infe', 'Incall', 'Ingobay', 'Inbay', 'Inloading', 'Inleavebay', 'Incheckout', 'Inleave'].map(function (field) {
                            return getStatePriority(b[field]);
                        }));
                        return aPriority - bPriority || countFilledFields(b) - countFilledFields(a);
                    });

                    var aNodes = [],
                        laneIds = ["2", "3", "4", "5", "6", "7", "8", "9", "10"];

                    sortedResults.forEach(function (result) {
                        var loadOrderId = result.load_order,
                            previousNodeId = null,
                            loadOrderNodeId = loadOrderId + "_" + result.voltas_no + "_LoadOrder",
                            loadOrderNode = {
                                "id": loadOrderNodeId,
                                "lane": "1",
                                "title": "Load Order: " + loadOrderId,
                                "titleAbbreviation": loadOrderId,
                                "children": [],
                                "highlighted": true,
                                "state": "Neutral",
                                "stateText": result.matricula + "\n " + that.getResourceBundle().getText("round") + ": " + result.voltas_no,
                                "focused": true,
                                "texts": null
                            };

                        aNodes.push(loadOrderNode);
                        previousNodeId = loadOrderNodeId;

                        var fields = ['incheckin', 'infe', 'incall', 'ingobay', 'inbay', 'inloading', 'inleavebay', 'incheckout', 'inleave'];

                        fields.forEach(function (field, fieldIndex) {
                            var state = null,
                                value = result[field];

                            switch (value) {
                                case 'S':
                                    state = "Positive";
                                    break;
                                case 'W':
                                    state = "Critical";
                                    break;
                                case 'E':
                                    state = "Negative";
                                    break;
                                case 'P':
                                    state = "Neutral";
                                    break;
                            }

                            if (state) {
                                var nodeId = loadOrderNodeId + "_" + fieldIndex,
                                    nodeDescription = fieldDescriptions[field] || { description: field, abbreviation: field };

                                var node = {
                                    "id": nodeId,
                                    "lane": laneIds[fieldIndex],
                                    "title": nodeDescription.description,
                                    "titleAbbreviation": nodeDescription.abbreviation,
                                    "children": [],
                                    "highlighted": true,
                                    "state": state,
                                    "stateText": nodeDescription.description,
                                    "focused": false,
                                    "texts": ""
                                };

                                if (previousNodeId) {
                                    var previousNode = aNodes.find(function (node) {
                                        return node.id === previousNodeId;
                                    });
                                    if (previousNode) {
                                        previousNode.children.push(nodeId);
                                    }
                                }

                                aNodes.push(node);
                                previousNodeId = nodeId;
                            }
                        });
                    });

                    var oViewModel = this.getModel("Trace");
                    oViewModel.setProperty("/nodes", aNodes);
                    oViewModel.updateBindings();

                    this.byId("processflow").setZoomLevel("Three");
                }
            },

            onNodePress: function (oEvent) {
                var oNode = oEvent.getParameters().mProperties,
                    oSelectedData = this.getModel("TerminalData").getData().results.find(function (item) {
                        return item.load_order === oNode.nodeId.split('_')[0];
                    });

                if (oNode.laneId === "2") {
                    if (!this._oDialogCI) {
                        var oTratorImage = !!oSelectedData.log_trator,
                            oReboqueImage = !!oSelectedData.log_reboque;

                        this._oDialogCI = new sap.m.Dialog({
                            title: "Confirmar matrícula do transporte - " + oSelectedData.load_order,
                            contentWidth: "60%",
                            contentHeight: oTratorImage ? "35%" : "18%",
                            content: new sap.m.VBox({
                                items: [
                                    new sap.m.FlexBox({
                                        alignItems: "Center",
                                        justifyContent: "Center",
                                        items: [
                                            new sap.m.Text({}).addStyleClass("sapUiSmallMarginBottom")
                                        ]
                                    }),
                                    new sap.m.VBox({
                                        alignItems: "Center",
                                        items: [
                                            new sap.m.HBox({
                                                alignItems: "Center",
                                                items: [
                                                    new sap.m.VBox({
                                                        alignItems: "Center",
                                                        items: oTratorImage ? [
                                                            new sap.m.Image({
                                                                id: this.createId("imagem"),
                                                                width: "450px",
                                                                height: "250px",
                                                                src: oSelectedData.log_trator
                                                            })
                                                        ] : [
                                                            new sap.m.Text({
                                                                text: "Imagem do Trator não disponível",
                                                                textAlign: "Center"
                                                            }).addStyleClass("customTextSize sapUiSmallMargin")
                                                        ]
                                                    }),
                                                    new sap.m.VBox({ width: "5rem" }),
                                                    new sap.m.VBox({
                                                        alignItems: "Center",
                                                        items: oReboqueImage ? [
                                                            new sap.m.Image({
                                                                id: this.createId("imagem2"),
                                                                width: "450px",
                                                                height: "250px",
                                                                src: oSelectedData.log_reboque
                                                            })
                                                        ] : [
                                                            new sap.m.Text({
                                                                text: "Imagem do Reboque não disponível",
                                                                textAlign: "Center"
                                                            }).addStyleClass("customTextSize sapUiSmallMargin")
                                                        ]
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    new sap.ui.layout.form.SimpleForm({
                                        id: this.createId("SimpleFormChange480_12120"),
                                        layout: "ResponsiveGridLayout",
                                        labelSpanXL: 3,
                                        labelSpanL: 3,
                                        labelSpanM: 12,
                                        labelSpanS: 12,
                                        adjustLabelSpan: false,
                                        emptySpanXL: 0,
                                        emptySpanL: 0,
                                        emptySpanM: 0,
                                        emptySpanS: 0,
                                        columnsXL: 2,
                                        columnsL: 2,
                                        columnsM: 1,
                                        singleContainerFullSize: false,
                                        content: [
                                            new sap.ui.core.Title({ text: "" }),
                                            new sap.m.Label({ text: "Matricula" }),
                                            new sap.m.Text({
                                                id: "matricula",
                                                name: "matricula",
                                            }),
                                            new sap.ui.core.Title({ text: "" }),
                                            new sap.m.Label({ text: "Matricula Reboque" }),
                                            new sap.m.Text({
                                                id: "matriculareboque",
                                                name: "matriculareboque",
                                            }),
                                        ]
                                    }),
                                ]
                            }),
                            afterClose: function () {
                                this.onDestroyDialog("_oDialogCI");
                            }.bind(this)
                        });

                        this._oDialogCI.addButton(new sap.m.Button({
                            text: "Fechar",
                            press: function () {
                                this.onDestroyDialog("_oDialogCI");
                            }.bind(this)
                        }));

                        this.getView().addDependent(this._oDialogCI);
                    }

                    if (oSelectedData.log_matricula || oSelectedData.matricula && oSelectedData.reboque) {
                        if (oSelectedData.matricula) {
                            sap.ui.getCore().byId("matricula").setText(oSelectedData ? oSelectedData.matricula : "");
                        } else if (oSelectedData.log_matricula) {
                            sap.ui.getCore().byId("matricula").setText(oSelectedData ? oSelectedData.log_matricula : "");
                        }
                        sap.ui.getCore().byId("matriculareboque").setText(oSelectedData ? oSelectedData.reboque : "");
                    }
                    this._oDialogCI.open();
                } else if (oNode.laneId === "5" || oNode.laneId === "6" || oNode.laneId === "9") {
                    if (!this._oDialog) {
                        var oLanes = {
                            "5": {
                                property: "LogQueue",
                                errorMessage: "Ainda não foi possível obter os registos da matrícula na Fila de Espera."
                            },
                            "6": {
                                property: "LogBay",
                                errorMessage: "Ainda não foi possível obter os registos da matrícula na Ilha de Carga."
                            },
                            "9": {
                                property: "LogCheckOut",
                                errorMessage: "Ainda não foi possível obter os registos da matrícula no Check Out."
                            }
                        };

                        var oLane = oLanes[oNode.laneId],
                            oImage = !!oSelectedData[oLane.property];

                        this._oDialog = new sap.m.Dialog({
                            title: "Confirmar matrícula do transporte - " + oSelectedData.LoadOrder,
                            contentWidth: "35%",
                            contentHeight: oImage ? "40%" : "19%",
                            content: new sap.m.VBox({
                                items: [
                                    new sap.m.FlexBox({
                                        alignItems: "Center",
                                        justifyContent: "Center",
                                        items: [
                                            new sap.m.Text({}).addStyleClass("sapUiSmallMarginBottom")
                                        ]
                                    }),
                                    new sap.m.VBox({
                                        alignItems: "Center",
                                        items: [
                                            new sap.m.HBox({
                                                alignItems: "Center",
                                                items: [
                                                    new sap.m.VBox({
                                                        alignItems: "Center",
                                                        items: oImage ? [
                                                            new sap.m.Image({
                                                                id: this.createId("imagem"),
                                                                width: "450px",
                                                                height: "250px",
                                                                src: oSelectedData[oLane.property]
                                                            })
                                                        ] : [
                                                            new sap.m.Text({
                                                                text: "Imagem não disponível",
                                                                textAlign: "Center"
                                                            }).addStyleClass("customTextSize sapUiSmallMargin")
                                                        ]
                                                    }),
                                                ]
                                            })
                                        ]
                                    }),
                                    new sap.ui.layout.form.SimpleForm({
                                        id: this.createId("SimpleFormChange480_12120"),
                                        layout: "ResponsiveGridLayout",
                                        labelSpanXL: 1,
                                        labelSpanL: 1,
                                        labelSpanM: 3,
                                        labelSpanS: 3,
                                        adjustLabelSpan: false,
                                        emptySpanXL: 0,
                                        emptySpanL: 0,
                                        emptySpanM: 0,
                                        emptySpanS: 0,
                                        columnsXL: 2,
                                        columnsL: 2,
                                        columnsM: 1,
                                        singleContainerFullSize: false,
                                        content: [
                                            new sap.ui.core.Title({ text: "" }),
                                            new sap.m.Label({ text: "Matricula" }),
                                            new sap.m.Text({
                                                id: this.createId("matricula"),
                                                name: "matricula",
                                            }),
                                        ]
                                    }),
                                ]
                            }),
                            afterClose: function () {
                                this.onDestroyDialog("_oDialog");
                            }.bind(this)
                        });

                        this._oDialog.addButton(new sap.m.Button({
                            text: "Fechar",
                            press: function () {
                                this.onDestroyDialog("_oDialog");
                            }.bind(this)
                        }));

                        this.getView().addDependent(this._oDialog);
                    }

                    if (oLane) {
                        var oPlate = this.byId(this.createId("matricula")),
                            oImage = this.byId(this.createId("imagem"));

                        if (oPlate) {
                            var matriculaValue = oSelectedData ? (oNode.state === "Positive" ? oSelectedData.matricula : oSelectedData.log_matricula) : "";
                            oPlate.setText(matriculaValue);
                        }
                        if (oImage) {
                            oImage.setSrc(oSelectedData[oLane.property]);
                        }
                        this._oDialog.open();
                    }
                }
            },

            onNavBackDetail: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                this.byId("processflow").destroyNodes();
                this.onNavigation("", "RouteMain", "");
            },

            handleAttachmentPress: function (oEvent) {
                var sPath = oEvent.getSource().getBindingContext().getPath();
                if (sPath) {
                    var oItemSelected = this.getModel().getObject(sPath).vbeln,
                        oComprovativos = this.getModel("ShipmentDetails").getProperty("/items");

                    if (oItemSelected) {
                        oItemSelected = "0" + oItemSelected;
                        oComprovativos = oComprovativos.filter(item => item.VBELN === oItemSelected);

                        if (oComprovativos && oComprovativos.length > 0) {
                            var oDocument = oComprovativos[0].ATTACHMENT;
                            this._pdfViewer = new sap.m.PDFViewer();

                            if (oDocument !== '') {
                                var hexToBytes = function (hex) {
                                    var bytes = new Uint8Array(hex.length / 2);
                                    for (var i = 0; i < hex.length; i += 2) {
                                        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
                                    }
                                    return bytes;
                                };

                                var byteArray = hexToBytes(oDocument),
                                    blob = new Blob([byteArray.buffer], { type: "application/pdf" }),
                                    _pdfurl = URL.createObjectURL(blob);

                                this._PDFViewer = new sap.m.PDFViewer({
                                    width: "auto",
                                    showDownloadButton: false,
                                    source: _pdfurl
                                });

                                jQuery.sap.addUrlWhitelist("blob");
                                this._PDFViewer.open();
                            }
                        }
                    }
                }
            },

            handleFillingAttachPress: function (oEvent) {
                debugger;
            }
        });
    });
