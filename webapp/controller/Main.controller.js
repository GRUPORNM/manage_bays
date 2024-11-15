sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/ui/model/Sorter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Filter",
],
    function (BaseController, JSONModel, formatter, Sorter, FilterOperator, Filter) {
        "use strict";

        return BaseController.extend("managebays.controller.Main", {

            formatter: formatter,

            onInit: function () {
                var oViewModel = new JSONModel({
                    load_order: "",
                    selectedItemId: null,
                    items: []
                }),
                    oModelTank = new JSONModel({
                        editMode: 1,
                        items: []
                    }),
                    oModelTankState = new JSONModel({
                        editMode: 1,
                        items: []
                    }),
                    oModelBays = new JSONModel({
                        editMode: 1,
                        items: []
                    }),
                    oTraceModel = new JSONModel({
                        nodes: [],
                    }),
                    oTerminalData = new JSONModel({
                        items: [],
                    }),
                    oLoadsMade = new JSONModel({
                        items: []
                    });

                this.setModel(oModelTankState, "TankState");
                this.setModel(oModelTank, "Tank");
                this.setModel(oModelBays, "Bays");
                this.setModel(oViewModel, "Queue");
                this.setModel(oTraceModel, "Trace");
                this.setModel(oTerminalData, "TerminalData");
                this.setModel(oLoadsMade, "LoadsMade");

                sessionStorage.setItem("goToLaunchpad", "X");
                this.getRouter("RouteMain").attachRouteMatched(this.getUserAuthentication, this);
            },

            onRouteMatched: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                this.getUserAuthentication();
            },

            onAfterRendering: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                try {
                    // this.onGetTanks(1);
                    this.onGetQueue();
                    this.onGetLoads();
                    this.onFilterTable();

                    if (sessionStorage.getItem("usr_type") === "RT") {
                        var oNavContainer = this.byId("pageContainer");
                        oNavContainer.to(this.byId("3"));

                        this.onGetTrace();

                        var oUrlParams = new URLSearchParams(window.location.search),
                            oParam = oUrlParams.get("page");

                        if (oParam) {
                            var oNavContainer = this.byId("pageContainer");

                            if (oNavContainer) {
                                oNavContainer.to(this.byId(oParam));

                                switch (oParam) {
                                    case "1":
                                        this.onGetBays();
                                    case "2":
                                        // this.onGetTanks(1);
                                    case "3":
                                        this.onGetTrace();
                                }
                            }
                        }
                    }

                    this.onStartWebSocket();
                } catch (error) {

                }
            },

            onFilterTable: function () {
                var oStartDate = new Date();
                oStartDate.setHours(1, 0, 0, 0);

                var oEndDate = new Date();
                oEndDate.setHours(23, 59, 59, 0);

                var oTableOutLoads = this.byId("outLoadsTable"),
                    oTableMadeLoads = this.byId("madeTable");

                var oDateFilter = new Filter("dataprevistacarregamento", FilterOperator.BT, oStartDate, oEndDate),
                    oShipTypeMade = new Filter("estado", FilterOperator.EQ, "3"),
                    oShipTypeOutLoads = new Filter({
                        filters: [
                            new Filter("estado", FilterOperator.EQ, "1"),
                            new Filter("estado", FilterOperator.EQ, "2")
                        ],
                        and: false
                    });

                var oGroupSorter = new sap.ui.model.Sorter("estado", false, function (oContext) {
                    var sEstado = oContext.getProperty("estado"),
                        sText = "";

                    switch (sEstado) {
                        case "1":
                            sText = "Criado";
                            break;
                        case "2":
                            sText = "Em Progresso";
                            break;
                        case "3":
                            sText = "Finalizado";
                            break;
                        case "4":
                            sText = "Erro";
                            break;
                        default:
                            sText = "Desconhecido";
                    }
                    return {
                        key: sEstado,
                        text: sText
                    };
                });

                oTableMadeLoads.getBinding("items").filter([oShipTypeMade, oDateFilter]);
                oTableOutLoads.getBinding("items").filter([oShipTypeOutLoads, oDateFilter]);
                oTableOutLoads.getBinding("items").sort(oGroupSorter);
                oTableMadeLoads.getBinding("items").sort(oGroupSorter);
            },

            onItemSelect: function (oEvent) {
                var oItem = oEvent.getParameter("item");

                if (oItem.getKey() === "1") {
                    this.onGetBays();
                } else if (oItem.getKey() === "4") {
                    // this.onGetTanks(1);
                    this.onBuildGeneralTankStateTable(1);
                } else if (oItem.getKey() === "3") {
                    this.onGetTrace();
                }

                this.byId("pageContainer").to(this.getView().createId(oItem.getKey()));
            },

            // GET DATA ****************************************
            onGetLoads: function () {
                var oModel = this.getModel(),
                    sUsrId = sessionStorage.getItem("usrid"),
                    that = this;

                var sPath = "/LoadsMade('" + sUsrId + "')";

                oModel.read(sPath, {
                    success: function (oData) {
                        if (oData) {
                            that.onBindShipmentsData(oData);
                        }
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: sap.m.MessageBox.Icon.ERROR,
                            title: "Erro",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onGetQueue: function (oChange) {
                var oModel = this.getModel(),
                    that = this;

                oModel.read("/BayQueue", {
                    success: function (oData) {
                        that.getModel("Queue").setData(oData);
                        that.onBuildGeneralQueueGrid(oData.results, oChange);
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onGetBays: function (oEditMode) {
                var oModel = this.getModel(),
                    that = this;

                oModel.read("/BayState", {
                    success: function (oData) {
                        that.onBuildGeneralBaysTable(oEditMode);

                        var aTransformedData = that.onTransformIlhaData(oData.results);
                        that.onBindIlhaTable(aTransformedData);
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            // onGetTanks: function (oEditMode) {
            //     var oModel = this.getModel(),
            //         that = this;

            //     oModel.read("/TankManage", {
            //         success: function (oData) {
            //             that.onBuildGeneralTankTable(oEditMode);
            //             var aTransformedData = that.onTransformTankData(oData.results);

            //             that.onBindTankTable(aTransformedData);
            //         },
            //         error: function (oError) {
            //             var sError = JSON.parse(oError.responseText).error.message.value;

            //             sap.m.MessageBox.alert(sError, {
            //                 icon: "ERROR",
            //                 onClose: null,
            //                 styleClass: '',
            //                 initialFocus: null,
            //                 textDirection: sap.ui.core.TextDirection.Inherit
            //             });
            //         }
            //     });
            // },

            onGetTrace: function () {
                var oModel = this.getModel(),
                    that = this;

                oModel.read("/TerminalTraces", {
                    success: function (oData) {
                        that.getModel("TerminalData").setData(oData);
                        that.onBuildTrace(oData);
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onGetCalls: function () {
                var oModel = this.getModel(),
                    that = this;

                oModel.read("/ScreenCalls", {
                    success: function (oData) {
                        that.onBuildScreenCalls(oData.results);
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onDeleteFromQueue: function () {
                var that = this,
                    oModel = this.getModel(),
                    oSelectedItem = this.getModel("Queue").getProperty("/load_order");

                var sPath = "/BayQueue('" + oSelectedItem + "')";

                if (oSelectedItem) {
                    oModel.remove(sPath, {
                        success: function (oData) {
                            oModel.refresh(true);
                            that.onGetQueue("update");
                            new sap.m.MessageBox.success("O transporte (" + oSelectedItem + ") foi removido da fila de espera com sucesso.", {
                                title: "Transporte Removido",
                                actions: [sap.m.MessageBox.Action.OK],
                                emphasizedAction: sap.m.MessageBox.Action.OK,
                            });
                        },
                        error: function (oError) {
                            var sError = JSON.parse(oError.responseText).error.message.value;

                            sap.m.MessageBox.alert(sError, {
                                icon: sap.m.MessageBox.Icon.ERROR,
                                title: "Erro",
                                onClose: null,
                                styleClass: '',
                                initialFocus: null,
                                textDirection: sap.ui.core.TextDirection.Inherit
                            });
                            that.onClearGridsSelection();
                        }
                    });
                } else {
                    sap.m.MessageBox.alert("Por favor selecione um transporte!", {
                        icon: sap.m.MessageBox.Icon.WARNING,
                        title: "Atenção",
                        onClose: null,
                        styleClass: '',
                        initialFocus: null,
                        textDirection: sap.ui.core.TextDirection.Inherit
                    });
                }
            },

            onCheckCompartments: function () {
                var that = this,
                    oModel = this.getModel(),
                    oSelectedItem = this.getModel("Queue").getProperty("/load_order");

                if (oSelectedItem) {
                    var aFilters = [
                        new sap.ui.model.Filter("LoadOrder", sap.ui.model.FilterOperator.EQ, oSelectedItem),
                    ];

                    oModel.read("/BaysQueueItems", {
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {
                                that.onOpenCompartmentsDialog(oData.results);
                            } else {
                                new sap.m.MessageBox.error("Não foi possível determinar as ilhas de carga para o transporte (" + oSelectedItem + ")", {
                                    title: "Erro",
                                    actions: [sap.m.MessageBox.Action.OK],
                                    emphasizedAction: sap.m.MessageBox.Action.OK,
                                    onClose: function (oAction) {
                                        if (oAction === sap.m.MessageBox.Action.OK) {
                                            that.onClearGridsSelection();
                                            that.getModel("Queue").setProperty("/load_order", null);
                                        }
                                    }
                                });
                            }
                        },
                        error: function (oError) {
                            var sError = JSON.parse(oError.responseText).error.message.value;

                            sap.m.MessageBox.alert(sError, {
                                icon: sap.m.MessageBox.Icon.ERROR,
                                title: "Erro",
                                onClose: null,
                                styleClass: '',
                                initialFocus: null,
                                textDirection: sap.ui.core.TextDirection.Inherit
                            });
                        }
                    });
                } else {
                    sap.m.MessageBox.alert(that.getResourceBundle().getText("pleaseSelectTransport"), {
                        icon: sap.m.MessageBox.Icon.WARNING,
                        title: that.getResourceBundle().getText("attention"),
                        onClose: null,
                        styleClass: '',
                        initialFocus: null,
                        textDirection: sap.ui.core.TextDirection.Inherit
                    });
                }
            },

            //ILHAS DE CARGA ****************************************
            onTransformIlhaData: function (aData) {
                let oTransformedData = {},
                    oStates = {};

                aData.forEach((oItem) => {
                    if (!oTransformedData[oItem.Ilha]) {
                        oTransformedData[oItem.Ilha] = { Ilha: oItem.Ilha };
                        oStates[oItem.Ilha] = [];
                    }

                    oTransformedData[oItem.Ilha]["Braco" + oItem.Braco] = {
                        EstadoIlha: oItem.EstadoIlha,
                        Material: oItem.Material,
                        Descricao: oItem.Maktx
                    };

                    oStates[oItem.Ilha].push(oItem.EstadoIlha);
                });

                for (let ilha in oStates) {
                    let uniqueStates = [...new Set(oStates[ilha])];

                    if (uniqueStates.length === 1 && uniqueStates[0] !== '1') {
                        oTransformedData[ilha].EstadoIlha = uniqueStates[0];
                    } else {
                        oTransformedData[ilha].EstadoIlha = '1';
                    }
                }

                return Object.values(oTransformedData);
            },

            onBindIlhaTable: function (aTransformedData) {
                var oModel = new sap.ui.model.json.JSONModel(),
                    oTable = sap.ui.getCore().byId("ilhaTable");

                if (oTable.getModel().getData()) {
                    oTable.setModel(oModel);
                }

                oModel.setData({ Ilha: aTransformedData });
                oTable.setModel(oModel);
                oTable.bindRows("/Ilha");
            },

            onBuildGeneralBaysTable: function (oEditMode) {
                var that = this,
                    oTable = sap.ui.getCore().byId("ilhaTable");

                if (!oTable) {
                    oTable = new sap.ui.table.Table("ilhaTable", {
                        visibleRowCount: 5,
                        selectionMode: sap.ui.table.SelectionMode.None,
                        enableGrouping: true,
                        ariaLabelledBy: "title"
                    });

                    var oToolbar = new sap.m.OverflowToolbar({
                        style: sap.m.ToolbarStyle.Clear,
                        content: [
                            new sap.m.Title({ text: "{i18n>baysState}", class: "_title" }),
                            new sap.m.ToolbarSpacer(),
                            new sap.m.Button({
                                id: "btBayEdit",
                                text: "Editar",
                                icon: "sap-icon://edit",
                                press: [this.onEditBayPress, this]
                            })
                        ]
                    });
                    oTable.addExtension(oToolbar);

                    var oRowSettingsTemplate = new sap.ui.table.RowSettings({
                        highlight: {
                            path: 'EstadoIlha',
                            formatter: that.formatter.highlightState
                        }
                    });
                    oTable.setRowSettingsTemplate(oRowSettingsTemplate);
                } else {
                    oTable.removeAllColumns();
                }

                var aColumnsInfo = [
                    { columnName: this.getResourceBundle().getText("island"), path: this.getResourceBundle().getText("bays") + " {Ilha}", sortProperty: "Status", filterProperty: "Status" },
                    { columnName: this.getResourceBundle().getText("braco1"), path: "Braco1" },
                    { columnName: this.getResourceBundle().getText("braco2"), path: "Braco2" },
                    { columnName: this.getResourceBundle().getText("braco3"), path: "Braco3" },
                    { columnName: this.getResourceBundle().getText("braco4"), path: "Braco4" }
                ];

                aColumnsInfo.forEach(function (columnInfo, index) {
                    var oTemplate;

                    if (index === 0) {
                        oTemplate = new sap.m.Text({
                            text: "{i18n>bays} {Ilha}",
                            wrapping: false
                        });
                    } else if (oEditMode === 2) {
                        oTemplate = new sap.m.Input({
                            value: {
                                path: columnInfo.path,
                                formatter: formatter._loadState
                            },
                            visible: {
                                path: columnInfo.path,
                                formatter: formatter.visibleTankColumn
                            },
                            state: {
                                path: columnInfo.path,
                                formatter: formatter.armState
                            },
                            showSuggestion: true,
                            showValueHelp: true,
                            valueHelpRequest: that.onValueHelpRequest.bind(that, "BAYS"),
                        });
                    } else {
                        oTemplate = new sap.m.ObjectStatus({
                            text: {
                                path: columnInfo.path,
                                formatter: that.formatter._loadState
                            },
                            state: {
                                path: columnInfo.path,
                                formatter: that.formatter.armState
                            },
                            wrapping: false
                        });
                    }

                    var oColumn = new sap.ui.table.Column({
                        label: new sap.m.Label({ text: columnInfo.columnName }),
                        template: oTemplate,
                        sortProperty: columnInfo.sortProperty || "",
                        filterProperty: columnInfo.filterProperty || ""
                    });

                    oTable.addColumn(oColumn);
                });

                var oPanel = this.byId("ilhaVBox");
                if (oPanel && !oPanel.getItems().includes(oTable)) {
                    oPanel.addItem(oTable);
                }
            },

            onUpdateBays: function (oIlha, oEntry) {
                var oModel = this.getModel(),
                    that = this;

                if (oEntry) {
                    new sap.m.MessageBox.warning(
                        this.getResourceBundle().getText("onUpdateBay1") + oIlha + this.getResourceBundle().getText("onUpdateTank2") + " " + oEntry.Braco + "?", {
                        title: this.getResourceBundle().getText("bayChange"),
                        actions: [
                            sap.m.MessageBox.Action.OK,
                            that.getResourceBundle().getText("updateBay"),
                            sap.m.MessageBox.Action.CANCEL
                        ],
                        emphasizedAction: sap.m.MessageBox.Action.OK,
                        onClose: function (oAction) {
                            if (oAction !== sap.m.MessageBox.Action.CANCEL) {
                                var sPath = "/BayState('" + oIlha + "')";

                                if (oAction === that.getResourceBundle().getText("updateBay")) {
                                    oEntry.Braco = "";
                                }

                                oModel.update(sPath, oEntry, {
                                    success: function () {
                                        that.onGetBays();
                                        that.onEditBayPress();
                                    },
                                    error: function (oError) {
                                        var sError = JSON.parse(oError.responseText).error.message.value;

                                        sap.m.MessageBox.alert(sError, {
                                            icon: "ERROR"
                                        });
                                    }
                                });
                            }
                        }
                    }
                    );
                }
            },

            onEditBayPress: function () {
                var oModel = this.getModel("Bays"),
                    currentEditMode = oModel.getProperty("/editMode"),
                    oEditMode = currentEditMode === 1 ? 2 : 1;

                oModel.setProperty("/editMode", oEditMode);
                this.onGetBays(oEditMode);

                var sIcon = oEditMode === 1 ? "sap-icon://edit" : "sap-icon://not-editable";
                sap.ui.getCore().byId("btBayEdit").setIcon(sIcon);
            },

            //TANQUES EXPEDITION ****************************************
            // onTransformTankData: function (aData) {
            //     let oTransformedData = {};

            //     aData.forEach((oItem) => {
            //         if (!oTransformedData[oItem.Ilha]) {
            //             oTransformedData[oItem.Ilha] = { Ilha: oItem.Ilha };
            //         }

            //         oTransformedData[oItem.Ilha][oItem.Braco] = {
            //             Tank: oItem.Tank,
            //             Material: oItem.Material,
            //             Descricao: oItem.TankDesc
            //         };
            //     });

            //     return Object.values(oTransformedData);
            // },

            // onBindTankTable: function (aTransformedData) {
            //     var oModel = new sap.ui.model.json.JSONModel();
            //     oModel.setData({ Tank: aTransformedData });

            //     var oTable = sap.ui.getCore().byId("tankTable");
            //     oTable.setModel(oModel);
            //     oTable.bindRows("/Tank");
            // },

            // onBuildGeneralTankTable: function (oEditMode) {
            //     var that = this,
            //         oTable = sap.ui.getCore().byId("tankTable");

            //     if (!oTable) {
            //         oTable = new sap.ui.table.Table("tankTable", {
            //             visibleRowCount: 5,
            //             selectionMode: sap.ui.table.SelectionMode.None,
            //             enableGrouping: true,
            //             ariaLabelledBy: "title"
            //         });

            //         var oToolbar = new sap.m.OverflowToolbar({
            //             style: sap.m.ToolbarStyle.Clear,
            //             content: [
            //                 new sap.m.Title({ text: "{i18n>tankManagement}", class: "_title" }),
            //                 new sap.m.ToolbarSpacer(),
            //                 new sap.m.Button({
            //                     id: "btTankEdit",
            //                     text: "Editar",
            //                     icon: "sap-icon://edit",
            //                     press: [this.onEditPress, this]
            //                 })
            //             ]
            //         });
            //         oTable.addExtension(oToolbar);

            //     } else {
            //         oTable.removeAllColumns();
            //     }

            //     var aColumnsInfo = [
            //         { columnName: this.getResourceBundle().getText("island"), path: this.getResourceBundle().getText("bays") + " {Ilha}", sortProperty: "Status", filterProperty: "Status" },
            //         { columnName: this.getResourceBundle().getText("braco1"), path: "1", vhPath: "/xTQAxTANKS_VH" },
            //         { columnName: this.getResourceBundle().getText("braco2"), path: "2", vhPath: "/xTQAxTANKS_VH" },
            //         { columnName: this.getResourceBundle().getText("braco3"), path: "3", vhPath: "/xTQAxTANKS_VH" },
            //         { columnName: this.getResourceBundle().getText("braco4"), path: "4", vhPath: "/xTQAxTANKS_VH" }
            //     ];

            //     aColumnsInfo.forEach(function (columnInfo, index) {
            //         var oTemplate;
            //         if (oEditMode === 2 && index !== 0) {
            //             oTemplate = new sap.m.Input({
            //                 value: {
            //                     path: columnInfo.path,
            //                     formatter: formatter.emptyTankColumn
            //                 },
            //                 showSuggestion: true,
            //                 showValueHelp: true,
            //                 valueHelpRequest: that.onValueHelpRequest.bind(that, "TANKS"),
            //                 suggestionItems: {
            //                     path: columnInfo.vhPath,
            //                     template: new sap.ui.core.Item({
            //                         key: "{" + columnInfo.path + "}",
            //                         text: "{" + columnInfo.path + "}"
            //                     })
            //                 }
            //             });
            //         } else {
            //             oTemplate = new sap.m.Label({
            //                 text: columnInfo.columnName === "Ilha" || columnInfo.columnName === "Bay" || columnInfo.columnName === "Isla" ?
            //                     "{i18n>bays} {Ilha}" : {
            //                         path: columnInfo.path,
            //                         formatter: formatter.emptyTankColumn
            //                     }
            //             });
            //         }

            //         var oColumn = new sap.ui.table.Column({
            //             label: new sap.m.Label({ text: columnInfo.columnName }),
            //             template: oTemplate,
            //             sortProperty: columnInfo.sortProperty,
            //             filterProperty: columnInfo.filterProperty
            //         });
            //         oTable.addColumn(oColumn);
            //     });

            //     var oPanel = this.byId("tankExpedition");
            //     if (oPanel && !oPanel.getItems().includes(oTable)) {
            //         oPanel.addItem(oTable);
            //     }
            // },

            // onUpdateTank: function (oIlha, oEntry) {
            //     var oModel = this.getModel(),
            //         that = this;

            //     if (oEntry) {
            //         new sap.m.MessageBox.warning(this.getResourceBundle().getText("onUpdateTank1") + oIlha + this.getResourceBundle().getText("onUpdateTank2") + " " + oEntry.Braco + " " + this.getResourceBundle().getText("onUpdateTank3") + oEntry.Tank + "?", {
            //             title: this.getResourceBundle().getText("tankChange"),
            //             actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
            //             emphasizedAction: sap.m.MessageBox.Action.OK,
            //             onClose: function (oAction) {
            //                 if (oAction === sap.m.MessageBox.Action.OK) {
            //                     var sPath = "/TankManage('" + oIlha + "')";

            //                     oModel.update(sPath, oEntry, {
            //                         success: function () {
            //                             new sap.m.MessageBox.success(that.getResourceBundle().getText("tankChangeSuccess"), {
            //                                 title: that.getResourceBundle().getText("tankChange"),
            //                                 actions: [sap.m.MessageBox.Action.OK],
            //                                 emphasizedAction: sap.m.MessageBox.Action.OK
            //                             });

            //                             that.onEditPress();
            //                         },
            //                         error: function (oError) {
            //                             var sError = JSON.parse(oError.responseText).error.message.value;

            //                             sap.m.MessageBox.alert(sError, {
            //                                 icon: "ERROR",
            //                                 onClose: null,
            //                                 styleClass: '',
            //                                 initialFocus: null,
            //                                 textDirection: sap.ui.core.TextDirection.Inherit
            //                             });
            //                         }
            //                     });
            //                 }
            //             }
            //         });
            //     }
            // },

            // onEditPress: function () {
            //     var oModel = this.getModel("Tank"),
            //         currentEditMode = oModel.getProperty("/editMode"),
            //         oEditMode = currentEditMode === 1 ? 2 : 1;

            //     oModel.setProperty("/editMode", oEditMode);
            //     this.onGetTanks(oEditMode);

            //     var sIcon = oEditMode === 1 ? "sap-icon://edit" : "sap-icon://not-editable";
            //     sap.ui.getCore().byId("btTankEdit").setIcon(sIcon);
            // },

            // TANQUES STATE ****************************************
            onBuildGeneralTankStateTable: function (oEditMode) {
                var oTable = sap.ui.getCore().byId("tankStateTable"),
                    that = this;

                if (!oTable) {
                    oTable = new sap.ui.table.Table("tankStateTable", {
                        width: "39%",
                        visibleRowCount: 12,
                        selectionMode: sap.ui.table.SelectionMode.None
                    });

                    var oToolbar = new sap.m.OverflowToolbar({
                        style: sap.m.ToolbarStyle.Clear,
                        content: [
                            new sap.m.Title({ text: "{i18n>tankState}", class: "_title" }),
                            new sap.m.ToolbarSpacer(),
                            new sap.m.Button({
                                id: "btTankStateEdit",
                                text: "Editar",
                                icon: "sap-icon://edit",
                                press: [this.onEditTankStatePress, this]
                            })
                        ]
                    });
                    oTable.addExtension(oToolbar);

                } else {
                    oTable.removeAllColumns();
                }

                var aColumnsInfo = [
                    { columnName: "Tank", path: "tank", sortProperty: "tank", filterProperty: "tank", vhPath: "/xTQAxTANKS_STATUS_VH" },
                    { columnName: "Status", path: "status_desc", sortProperty: "status_desc", filterProperty: "status_desc", vhPath: "/xTQAxTANKS_STATUS_VH" }
                ];

                aColumnsInfo.forEach(function (columnInfo) {
                    var oTemplate;

                    if (columnInfo.columnName === "Status" && oEditMode === 2) {
                        oTemplate = new sap.m.Input({
                            value: {
                                path: columnInfo.path,
                            },
                            showSuggestion: true,
                            showValueHelp: true,
                            valueHelpRequest: that.onValueHelpRequest.bind(that, "TANKS_STATE"),
                            suggestionItems: {
                                path: columnInfo.vhPath,
                                template: new sap.ui.core.Item({
                                    key: "{" + columnInfo.path + "}",
                                    text: "{" + columnInfo.path + "}"
                                })
                            }
                        });
                    }
                    else {
                        oTemplate = new sap.m.Text({
                            text: {
                                path: columnInfo.path
                            }
                        });
                    }

                    var oColumn = new sap.ui.table.Column({
                        width: "22em",
                        label: new sap.m.Label({ text: columnInfo.columnName }),
                        template: oTemplate,
                        sortProperty: columnInfo.sortProperty,
                        filterProperty: columnInfo.filterProperty
                    });
                    oTable.addColumn(oColumn);
                });

                var oPanel = this.byId("tankStateVBox");
                if (oPanel && !oPanel.getItems().includes(oTable)) {
                    oPanel.addItem(oTable);
                }

                var oModel = this.getModel();
                oTable.setModel(oModel);
                oTable.bindRows("/xTQAxTANKS_DD");
            },

            onEditTankStatePress: function () {
                var oModel = this.getModel("TankState"),
                    currentEditMode = oModel.getProperty("/editMode"),
                    oEditMode = currentEditMode === 1 ? 2 : 1;

                oModel.setProperty("/editMode", oEditMode);
                this.onBuildGeneralTankStateTable(oEditMode);

                var sIcon = oEditMode === 1 ? "sap-icon://edit" : "sap-icon://not-editable";
                sap.ui.getCore().byId("btTankStateEdit").setIcon(sIcon);
            },

            onUpdateTankState: function (sPath, oEntry) {
                var oModel = this.getModel(),
                    that = this;

                if (oEntry) {
                    sPath = "/" + sPath;
                    oModel.update(sPath, oEntry, {
                        success: function () {
                            new sap.m.MessageBox.success(that.getResourceBundle().getText("tankChangeSuccess"), {
                                title: that.getResourceBundle().getText("tankChange"),
                                actions: [sap.m.MessageBox.Action.OK],
                                emphasizedAction: sap.m.MessageBox.Action.OK
                            });

                            that.onEditTankStatePress();
                        },
                        error: function (oError) {
                            var sError = JSON.parse(oError.responseText).error.message.value;

                            sap.m.MessageBox.alert(sError, {
                                icon: "ERROR",
                                onClose: null,
                                actions: [sap.m.MessageBox.Action.CLOSE],
                                styleClass: '',
                                initialFocus: null,
                                textDirection: sap.ui.core.TextDirection.Inherit
                            });
                        }
                    });
                }
            },

            // FILA DE ESPERA ****************************************
            onBuildGeneralQueueGrid: function (oResults, oChange) {
                var oGridList,
                    that = this;

                if (oResults) {
                    oResults.sort(function (a, b) {
                        if (a.IlhaDeCarga < b.IlhaDeCarga) return -1;
                        if (a.IlhaDeCarga > b.IlhaDeCarga) return 1;

                        var posA = parseInt(a.PosicaoFila, 10);
                        var posB = parseInt(b.PosicaoFila, 10);
                        return posA - posB;
                    });

                    for (let i = 1; i < 6; i++) {
                        var oPanel = this.byId("ilha" + i);

                        oGridList = sap.ui.getCore().byId("grid" + i);

                        if (oChange) {
                            if (oGridList) {
                                oGridList.removeAllItems();
                            }
                        }

                        if (!oGridList) {
                            oGridList = new sap.f.GridList({
                                id: "grid" + i,
                                noDataText: this.getResourceBundle().getText("noDataText"),
                                selectionChange: that.onSelectionChange.bind(that),
                                mode: "SingleSelect",
                                headerText: "{i18n>island} " + i,
                                onItemSelect: "",
                                customLayout: new sap.ui.layout.cssgrid.GridBoxLayout({
                                    boxMinWidth: "15rem",
                                    boxWidth: "15rem"
                                })
                            });

                            var oDragDropConfig = new sap.f.dnd.GridDropInfo({
                                targetAggregation: "items",
                                dropPosition: "Between",
                                dropLayout: "Horizontal",
                                drop: this.onDrop.bind(this)
                            });

                            var oDragInfo = new sap.ui.core.dnd.DragInfo({
                                sourceAggregation: "items"
                            });

                            oGridList.addDragDropConfig(oDragInfo);
                            oGridList.addDragDropConfig(oDragDropConfig);
                        }

                        oResults.forEach((oItem) => {
                            if (oItem.IlhaDeCarga == i) {
                                var highlightType = oItem.PosicaoFila == "0" ? "Success" : "Warning";

                                var oGridListItem = new sap.f.GridListItem({
                                    highlight: highlightType,
                                    type: "Inactive",
                                    unread: false
                                }).addStyleClass("custom-grid-margin");

                                var oMainVBox = new sap.m.VBox({
                                    height: "100%",
                                    layoutData: new sap.m.FlexItemData({ growFactor: 1, shrinkFactor: 0 })
                                });

                                oMainVBox.addItem(new sap.m.VBox().addStyleClass("sapUiSmallMargin").addItem(new sap.m.HBox({
                                    justifyContent: "SpaceBetween"
                                }).addItem(new sap.m.Title({
                                    wrapping: true
                                })).addItem(new sap.tnt.InfoLabel({
                                    text: this.getResourceBundle().getText("bayPosition") + oItem.PosicaoFila,
                                    colorScheme: 6
                                })).addStyleClass("sapUiTinyMarginBottom")).addItem(new sap.m.Title({
                                    text: this.getResourceBundle().getText("order") + oItem.Notacarga,
                                    wrapping: true,
                                })).addItem(new sap.m.Title({
                                    text: this.getResourceBundle().getText("plates") + oItem.Matricula,
                                    wrapping: true
                                })));


                                oGridListItem.addContent(oMainVBox);
                                oGridList.addItem(oGridListItem);
                            }
                        });
                        oPanel.addContent(oGridList);
                    }
                } else {

                }
            },

            onDrop: function (oInfo) {
                var that = this,
                    oTextForce = "",
                    oEntry = {},
                    ilhaDestino,
                    oItemDestino,
                    oDragged = oInfo.getParameter("draggedControl"),
                    oDropped = oInfo.getParameter("droppedControl"),
                    oGrid = oDragged.getParent(),
                    oModel = this.getModel("Queue"),
                    oModelUpdate = this.getModel(),
                    ilha = oGrid.sId.replace(/[^\d]/g, ''),
                    aItems = oModel.getProperty("/results").filter(item => item.IlhaDeCarga === ilha),
                    oItem = aItems[oGrid.indexOfItem(oDragged)],
                    ilhaOrigem = oDragged.getParent().sId.replace(/[^\d]/g, '');

                if (oItem.PosicaoFila === "0") {
                    new sap.m.MessageBox.error("O transporte " + oItem.NrOrdemCliente + " está neste momento a carregar e não pode ser alterado!", {
                        title: that.getResourceBundle().getText("queueChange"),
                        actions: [sap.m.MessageBox.Action.OK],
                        emphasizedAction: sap.m.MessageBox.Action.OK,
                    });
                } else {
                    if (oDropped) {
                        ilhaDestino = oDropped.getParent().sId.replace(/[^\d]/g, '');
                        oItemDestino = aItems[oGrid.indexOfItem(oDropped)];
                        if (oItemDestino) {
                            if (oItemDestino.PosicaoFila === "0") {
                                new sap.m.MessageBox.error(that.getResourceBundle().getText("queueChangeNotPossible"), {
                                    title: that.getResourceBundle().getText("queueChange"),
                                    actions: [sap.m.MessageBox.Action.OK],
                                    emphasizedAction: sap.m.MessageBox.Action.OK,
                                });
                            } else {
                                continueUpdate.call(that);
                            }
                        } else {
                            continueUpdate.call(that);
                        }
                    } else {
                        this.onChangeDestinationIsland(ilhaOrigem, function (selectedIsland) {
                            ilhaDestino = selectedIsland;
                            continueUpdate.call(that);
                        });
                    }
                }

                function continueUpdate() {
                    var that = this;

                    if (oItem != oItemDestino) {
                        if (oItem != null) {
                            if (ilhaOrigem != ilhaDestino) {
                                oTextForce = "changeBayPositionForce";
                                oEntry = {
                                    PosicaoFila: oItem.PosicaoFila,
                                    IlhaDeCarga: ilhaDestino
                                };
                            } else {
                                oTextForce = "changeQueuePosition";
                                oEntry = {
                                    PosicaoFila: oItem.PosicaoFila,
                                    PosicaoDestino: oItemDestino ? oItemDestino.PosicaoFila : null
                                };
                            }

                            new sap.m.MessageBox.warning(that.getResourceBundle().getText(oTextForce) + oItem.NrOrdemCliente, {
                                title: that.getResourceBundle().getText("queueChange"),
                                actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                                emphasizedAction: sap.m.MessageBox.Action.OK,
                                onClose: function (oAction) {
                                    if (oAction === sap.m.MessageBox.Action.OK) {
                                        var sPath = "/BayQueue('" + oItem.NrOrdemCliente + "')";

                                        oModelUpdate.update(sPath, oEntry, {
                                            success: function () {
                                                that.onGetQueue("update");

                                                new sap.m.MessageBox.success(that.getResourceBundle().getText("onDrop1") + oItem.Matricula + " " + that.getResourceBundle().getText("onDrop2"), {
                                                    title: that.getResourceBundle().getText("queueChange"),
                                                    actions: [sap.m.MessageBox.Action.OK],
                                                    emphasizedAction: sap.m.MessageBox.Action.OK
                                                });

                                            },
                                            error: function (oError) {
                                                var sError = JSON.parse(oError.responseText).error.message.value;

                                                sap.m.MessageBox.alert(sError, {
                                                    icon: "ERROR",
                                                    onClose: null,
                                                    actions: [sap.m.MessageBox.Action.CLOSE],
                                                    styleClass: '',
                                                    initialFocus: null,
                                                    textDirection: sap.ui.core.TextDirection.Inherit
                                                });
                                            }
                                        });
                                    }
                                }
                            });

                        } else {
                            that.onCallPopup();
                        }
                    } else {
                        that.onCallPopup();
                    }
                }
            },

            onChangeDestinationIsland: function (ilhaOrigem, callback) {
                var that = this,
                    oDialog = new sap.m.Dialog({
                        title: this.getResourceBundle().getText("onChangeDestinationIslandTitle"),
                        contentWidth: "530px",
                        contentHeight: "100px",
                        content: [
                            new sap.m.VBox({
                                items: [
                                    new sap.m.Label({
                                        text: this.getResourceBundle().getText("onChangeDestinationIslandText"),
                                        labelFor: 'destinationIslandInput',
                                        width: '100%'
                                    }),
                                    new sap.m.Input('destinationIslandInput', {
                                        type: sap.m.InputType.Number,
                                        placeholder: this.getResourceBundle().getText("onChangeDestinationIslandPlaceHolder"),
                                        width: '100%',
                                        liveChange: function (oEvent) {
                                            var sValue = oEvent.getParameter("value").trim(),
                                                iValue = parseInt(sValue, 10),
                                                isValid = !isNaN(iValue) && iValue >= 1 && iValue <= 5 && iValue !== parseInt(ilhaOrigem, 10);

                                            oDialog.getBeginButton().setEnabled(isValid);
                                        },
                                        change: function (oEvent) {
                                            var sValue = oEvent.getParameter("value").trim(),
                                                iValue = parseInt(sValue, 10);

                                            if (iValue < 1 || iValue > 5 || iValue === parseInt(ilhaOrigem, 10)) {
                                                sap.m.MessageToast.show(that.getResourceBundle().getText("invalidValueMessage"));
                                                oEvent.getSource().setValue("");
                                            }
                                        }
                                    }).addEventDelegate({
                                        onAfterRendering: function (oEvent) {
                                            var oInput = oEvent.srcControl;
                                            var oDomRef = oInput.getDomRef();
                                            if (oDomRef) {
                                                oDomRef.setAttribute("min", "1");
                                                oDomRef.setAttribute("max", "5");
                                            }
                                        }
                                    })
                                ],
                                justifyContent: "Center",
                                alignItems: "Center",
                                width: "100%"
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: 'OK',
                            enabled: false,
                            press: function () {
                                var selectedIsland = sap.ui.getCore().byId('destinationIslandInput').getValue();
                                oDialog.close();
                                callback(selectedIsland);
                            }
                        }),
                        endButton: new sap.m.Button({
                            text: 'Cancel',
                            press: function () {
                                oDialog.close();
                            }
                        }),
                        afterClose: function () {
                            oDialog.destroy();
                        }
                    });

                oDialog.open();
            },

            onOpenCompartmentsDialog: function (oData) {
                var that = this;
                if (!this._oCompartmentDialog) {
                    this._oCompartmentDialog = new sap.m.Dialog({
                        title: this.getResourceBundle().getText("compartmentsDialogTitle"),
                        contentWidth: "80%",
                        contentHeight: "70%",
                        content: [
                            new sap.m.Table({
                                id: this.createId("compartmentTable"),
                                columns: [
                                    new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("compartmentCode") }) }),
                                    new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("arm") }) }),
                                    // new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("productCode") }) }),
                                    new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("productDescription") }) }),
                                    new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("productQuantity") }) }),
                                    new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("tank") }) })
                                ]
                            }).setModel(new sap.ui.model.json.JSONModel(oData)).bindItems({
                                path: "/",
                                template: new sap.m.ColumnListItem({
                                    cells: [
                                        new sap.m.Text({
                                            text: {
                                                path: "Codcompartimento",
                                                formatter: this.formatter.removeZerosCompartment
                                            }
                                        }),
                                        new sap.m.Text({ text: "{Braco}" }),
                                        // new sap.m.Text({ text: "{Codprodcomercial}" }),
                                        new sap.m.Text({ text: "{Maktx}" }),
                                        new sap.m.Text({ text: "{Quantprodcomercial}" }),
                                        new sap.m.Text({ text: "{Tanque}" })
                                    ]
                                }),
                                sorter: [
                                    new sap.ui.model.Sorter("Ilha", false, function (oContext) {
                                        var sIlha = oContext.getProperty("Ilha");
                                        return {
                                            key: sIlha,
                                            text: that.getResourceBundle().getText("loadingIsland") + ": " + sIlha
                                        };
                                    }),
                                    new sap.ui.model.Sorter("Codcompartimento", false)
                                ]
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: that.getResourceBundle().getText("close"),
                            press: function () {
                                this.onClearGridsSelection();
                                this._oCompartmentDialog.close();
                                this._oCompartmentDialog.destroy();
                                this._oCompartmentDialog = null;
                                this.getModel("Queue").setProperty("/load_order", null);
                            }.bind(this)
                        })
                    });

                    this.getView().addDependent(this._oCompartmentDialog);
                }

                var oTable = this.byId(this.createId("compartmentTable"));
                oTable.getModel().setData(oData);
                this._oCompartmentDialog.open();
            },

            onSelectionChange: function (oEvent) {
                var oGridList = oEvent.getSource(),
                    oSelectedItem = oEvent.getParameter("listItem"),
                    oSelectedItemId = oSelectedItem.getId(),
                    oText = oSelectedItem.getContent()[0].getItems()[0].getItems()[1].getText(),
                    oLoadOrder = oText.split(':')[1].trim();

                this.getModel("Queue").setProperty("/selectedItemId", oSelectedItemId);
                this.getModel("Queue").setProperty("/load_order", oLoadOrder);

                this.onRemoveSelectionsFromGridLists(oGridList, oSelectedItemId);
            },

            onRemoveSelectionsFromGridLists: function (oCurrentGridList, oSelectedItemId) {
                for (let i = 1; i < 6; i++) {
                    var oGridList = sap.ui.getCore().byId("grid" + i);
                    if (oGridList && oGridList !== oCurrentGridList) {
                        oGridList.getSelectedItems().forEach(function (oItem) {
                            if (oItem.getId() !== oSelectedItemId) {
                                oGridList.removeSelections(true);
                            }
                        });
                    }
                }
            },

            onClearGridsSelection: function () {
                for (let i = 1; i < 6; i++) {
                    var oGridList = sap.ui.getCore().byId("grid" + i);
                    if (oGridList) {
                        oGridList.removeSelections(true);
                    }
                }
            },

            // CIRCUITO ****************************************
            onPrintAttachments: function (oLoadOrder) {
                if (oLoadOrder) {
                    var sPath = "/PrintAttachments('" + oLoadOrder + "')",
                        oModel = this.getModel(),
                        oEntry = {};

                    oEntry = {
                        LoadOrder: oLoadOrder,
                    };

                    oModel.update(sPath, oEntry, {
                        success: function (oData) {
                            sap.m.MessageBox.success(that.getResourceBundle().getText("attachmentsPrinted"), {
                                title: that.getResourceBundle().getText("attachmentsPrintedTitle"),
                                actions: [sap.m.MessageBox.Action.OK],
                                emphasizedAction: sap.m.MessageBox.Action.OK,
                            });
                        },
                        error: function (oError) {
                            var sError = JSON.parse(oError.responseText).error.message.value;

                            sap.m.MessageBox.alert(sError, {
                                icon: "ERROR",
                                onClose: null,
                                styleClass: '',
                                initialFocus: null,
                                textDirection: sap.ui.core.TextDirection.Inherit
                            });
                        }
                    });
                }
            },

            onManagePlate: function (oLoadOrder, oPlateLog, oLane) {
                var sPath = "/PlatesManage('" + oLoadOrder + "')",
                    oModel = this.getModel(),
                    that = this,
                    sMessage = "",
                    sTitle = "";

                var oEntry = {
                    PlateLog: oPlateLog,
                    Matricula: "",
                    Reboque: "",
                    Type: oLane
                };

                if (oLane.includes("Confirm") && !oLane.includes("FE")) {
                    oEntry.Matricula = sap.ui.getCore().byId("matricula").getValue();

                    sMessage = "plateConfirmedSuccessfully";
                    sTitle = "plateConfirmedTitle";
                } else if (oLane.includes("CH")) {
                    sMessage = "callExecutedSuccessfully";
                    sTitle = "callExecutedTitle";
                } else if (!oLane.includes("CH")) {
                    sMessage = "readExecutedSuccessfully";
                    sTitle = "readExecutedTitle";
                }

                if (oLane === "Confirm-CI") {
                    oEntry.Reboque = sap.ui.getCore().byId("matriculareboque").getValue();
                }

                oModel.update(sPath, oEntry, {
                    success: function () {
                        if (that._oDialog) {
                            that._oDialog.close();
                            that._oDialog.destroy();
                            that._oDialog = null;
                        }
                        that.onGetTrace();

                        sap.m.MessageBox.success(that.getResourceBundle().getText(sMessage), {
                            title: that.getResourceBundle().getText(sTitle),
                            actions: [sap.m.MessageBox.Action.OK],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                        });
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onChangeBayCall: function (oLoadOrder, oBay, oError) {
                var sPath = "/CallsManage('" + oLoadOrder + "')",
                    oModel = this.getModel(),
                    sErrorMessage = "",
                    sTitleMessage = "",
                    that = this,
                    oEntry = {};

                oEntry = {
                    Bay: oBay,
                    Error: oError
                };

                if (oError) {
                    sTitleMessage = "Ilha Alterada";
                    sErrorMessage = "Ilha de Carga alterada com sucesso";
                } else {
                    sTitleMessage = "Chamada Alterada";
                    sErrorMessage = "Chamada alterada com sucesso para a Ilha de Carga ";
                }

                oModel.update(sPath, oEntry, {
                    success: function () {
                        that.onGetTrace();
                        if (that._oDialog) {
                            that._oDialog.close();
                            that._oDialog.destroy();
                            that._oDialog = null;
                        }

                        new sap.m.MessageBox.success(sErrorMessage + oBay, {
                            title: sTitleMessage,
                            actions: [sap.m.MessageBox.Action.OK],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                        });
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onAssociateDriver: function (oLoadOrder, oMotorista) {
                var sPath = "/DriversManage('" + oLoadOrder + "')",
                    oModel = this.getModel(),
                    that = this,
                    oEntry = {};

                oEntry = {
                    Motorista: oMotorista,
                };

                oModel.update(sPath, oEntry, {
                    success: function () {
                        that.onGetTrace();
                        if (that._oAssociateDialog) {
                            that._oAssociateDialog.close();
                            that._oAssociateDialog.destroy();
                            that._oAssociateDialog = null;
                        }

                        new sap.m.MessageBox.success(that.getResourceBundle().getText("driverAssociatedSuccessfully"), {
                            title: that.getResourceBundle().getText("driverAssociatedTitle"),
                            actions: [sap.m.MessageBox.Action.OK],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                        });

                        sap.ui.getCore().byId("btDriverAssociate").setProperty("visible", false);
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onCreateTrace: function (oLoadOrder) {
                var oModel = this.getModel(),
                    that = this,
                    oEntry = {};

                oEntry = {
                    LoadOrder: oLoadOrder,
                };

                oModel.create("/TerminalTraces", oEntry, {
                    success: function () {
                        that.onGetTrace();
                        new sap.m.MessageBox.success("Check-In da ordem de carga " + oLoadOrder + " criado com sucesso!", {
                            title: "Check-In",
                            actions: [sap.m.MessageBox.Action.OK],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                        });
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }
                });
            },

            onOpenBarreira: function (oLoadOrder, oDoorType) {
                var sPath = "/BarriersManage('" + oLoadOrder + "')",
                    oModel = this.getModel(),
                    that = this,
                    oEntry = {};

                oEntry = {
                    DoorType: oDoorType,
                };

                oModel.update(sPath, oEntry, {
                    success: function () {
                        that.onGetTrace();
                        if (that._oDialog) {
                            that._oDialog.close();
                            that._oDialog.destroy();
                            that._oDialog = null;
                        }

                        new sap.m.MessageBox.success(that.getResourceBundle().getText("barrierOpenedSuccessfully"), {
                            title: that.getResourceBundle().getText("barrierOpenedTitle"),
                            actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                        });
                    },
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;

                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
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
                    "Incheckin": { description: this.getResourceBundle().getText("checkIn"), abbreviation: "CI" },
                    "Infe": { description: this.getResourceBundle().getText("queue"), abbreviation: "FE" },
                    "Incall": { description: this.getResourceBundle().getText("call"), abbreviation: "CH" },
                    "Ingobay": { description: this.getResourceBundle().getText("queue"), abbreviation: "II" },
                    "Inbay": { description: this.getResourceBundle().getText("bays"), abbreviation: "NI" },
                    "Inloading": { description: this.getResourceBundle().getText("loading"), abbreviation: "AC" },
                    "Inleavebay": { description: this.getResourceBundle().getText("exitBay"), abbreviation: "SI" },
                    "Incheckout": { description: this.getResourceBundle().getText("checkOut"), abbreviation: "CO" },
                    "Inleave": { description: this.getResourceBundle().getText("exitTerminal"), abbreviation: "ST" },
                };

                var stateMessages = {
                    "Incheckin": {
                        "Positive": this.getResourceBundle().getText("checkInSuccessfully"),
                        "Critical": this.getResourceBundle().getText("checkInProblems"),
                        "Negative": this.getResourceBundle().getText("checkInError")
                    },
                    "Infe": {
                        "Positive": this.getResourceBundle().getText("goToQueue"),
                        "Critical": this.getResourceBundle().getText("queueProblem"),
                        "Negative": this.getResourceBundle().getText("queueError")
                    },
                    "Incall": {
                        "Positive": this.getResourceBundle().getText("callExecutedSuccessfully"),
                        "Critical": this.getResourceBundle().getText("callExecutedProblems"),
                        "Negative": this.getResourceBundle().getText("callExecutedError")
                    },
                    "Ingobay": {
                        "Neutral": this.getResourceBundle().getText("readingExecuted"),
                        "Positive": this.getResourceBundle().getText("goToBay"),
                        "Critical": this.getResourceBundle().getText("readProblems"),
                        "Negative": this.getResourceBundle().getText("readError")
                    },
                    "Inloading": {
                        "Positive": this.getResourceBundle().getText("loadingExecutedSuccessfully"),
                        "Critical": this.getResourceBundle().getText("loadingProblems"),
                        "Negative": this.getResourceBundle().getText("loadingError")
                    },
                    "Inbay": {
                        "Neutral": this.getResourceBundle().getText("readingExecuted"),
                        "Positive": this.getResourceBundle().getText("bayArrived"),
                        "Critical": this.getResourceBundle().getText("readPlateProblems"),
                        "Negative": this.getResourceBundle().getText("bayError")
                    },
                    "Inleavebay": {
                        "Positive": this.getResourceBundle().getText("goToCheckOut"),
                        "Critical": this.getResourceBundle().getText("leaveBayProblems"),
                        "Negative": this.getResourceBundle().getText("leaveBayError")
                    },
                    "Incheckout": {
                        "Neutral": this.getResourceBundle().getText("readingExecuted"),
                        "Positive": this.getResourceBundle().getText("checkoutArrived"),
                        "Critical": this.getResourceBundle().getText("readPlateProblems"),
                        "Negative": this.getResourceBundle().getText("checkoutError")
                    },
                    "Inleave": {
                        "Positive": this.getResourceBundle().getText("authorizedToLeave"),
                        "Critical": this.getResourceBundle().getText("problemToLeave"),
                        "Negative": this.getResourceBundle().getText("errorToLeave")
                    },
                };

                function countFilledFields(result) {
                    var fields = ['Incheckin', 'Infe', 'Incall', 'Ingobay', 'Inloading', 'Inbay', 'Inleavebay', 'Incheckout', 'Inleave'];
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

                if (oResults && oResults.results && oResults.results.length > 0) {
                    var sortedResults = oResults.results.sort(function (a, b) {
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
                        var loadOrderId = result.LoadOrder,
                            previousNodeId = null,
                            loadOrderNodeId = loadOrderId + "_LoadOrder",
                            loadOrderNode = {
                                "id": loadOrderNodeId,
                                "lane": "1",
                                "title": that.getResourceBundle().getText("loadOrder") + ": " + loadOrderId,
                                "titleAbbreviation": loadOrderId,
                                "children": [],
                                "highlighted": true,
                                "state": "Neutral",
                                "stateText": result.Matricula + "\n " + that.getResourceBundle().getText("bay") + ": " + result.IlhaDeCarga,
                                "focused": true,
                                "texts": that.getResourceBundle().getText("round") + ": " + result.VoltasNo
                            };

                        aNodes.push(loadOrderNode);
                        previousNodeId = loadOrderNodeId;

                        var fields = ['Incheckin', 'Infe', 'Incall', 'Ingobay', 'Inbay', 'Inloading', 'Inleavebay', 'Incheckout', 'Inleave'];

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
                                var nodeId = loadOrderId + "_" + fieldIndex,
                                    nodeDescription = fieldDescriptions[field] || { description: field, abbreviation: field },
                                    errorMessage = null;

                                if (state != "Positive") {
                                    var oSelectedData = that.getModel("TerminalData").getData().results.find(function (item) {
                                        return item.LoadOrder === loadOrderId;
                                    });

                                    if (oSelectedData && oSelectedData.ErrorMessage) {
                                        errorMessage = oSelectedData.ErrorMessage;
                                    }
                                }

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
                                    "texts": [errorMessage || stateMessages[field][state]],
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
                        }.bind(that));
                    });

                    var oViewModel = this.getModel("Trace");
                    oViewModel.setProperty("/nodes", aNodes);
                    oViewModel.updateBindings();

                    this.byId("processflow").setZoomLevel("Three");
                }
            },

            onBuildScreenCalls: function (oData) {
                var that = this;
                if (oData) {
                    var calculateRemainingTime = function (endCallDate) {
                        if (!endCallDate) {
                            return "N/A";
                        }

                        var now = new Date(),
                            endDate = new Date(endCallDate),
                            diffInMs = endDate - now;

                        if (diffInMs <= 0) {
                            return that.getResourceBundle().getText("callTimeExpired");
                        }

                        var remainingMinutes = Math.floor(diffInMs / (1000 * 60)),
                            remainingSeconds = Math.floor((diffInMs % (1000 * 60)) / 1000);

                        return remainingMinutes + ":" + (remainingSeconds < 10 ? "0" : "") + remainingSeconds + " min";
                    };

                    oData.forEach(function (item) {
                        item.RemainingTime = calculateRemainingTime(item.EndCall);
                    });

                    if (!this._oScreenCallsDialog) {
                        this._oScreenCallsDialog = new sap.m.Dialog({
                            title: that.getResourceBundle().getText("screenCallsTitle"),
                            contentWidth: "40%",
                            contentHeight: "35%",
                            content: [
                                new sap.m.Table({
                                    id: this.createId("screenCallsTable"),
                                    noDataText: that.getResourceBundle().getText("noCallsRunning"),
                                    columns: [
                                        new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("loadOrder") }) }),
                                        new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("callPosition") }) }),
                                        new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("remainingTime") }) }),
                                        // new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("waitingTime") }) }),
                                    ]
                                }).setModel(new sap.ui.model.json.JSONModel(oData)).bindItems({
                                    path: "/",
                                    template: new sap.m.ColumnListItem({
                                        cells: [
                                            new sap.m.Text({ text: "{LoadOrder}" }),
                                            new sap.m.Text({ text: "{CallPosition}" }),
                                            new sap.m.Text({ text: "{RemainingTime}" }),
                                            // new sap.m.Text({ text: "{CallStatus}" }),
                                        ]
                                    }),
                                    sorter: new sap.ui.model.Sorter("CallStatus", false, function (oContext) {
                                        var sStatus = oContext.getProperty("CallStatus");

                                        return {
                                            key: sStatus,
                                            text: sStatus === "1" ? 'Tempo Esgotado' : "Ativo"
                                        };
                                    })
                                })
                            ],
                            beginButton: new sap.m.Button({
                                text: that.getResourceBundle().getText("close"),
                                press: function () {
                                    this._oScreenCallsDialog.close();
                                    this._oScreenCallsDialog.destroy();
                                    this._oScreenCallsDialog = null;
                                }.bind(this)
                            })
                        });

                        this.getView().addDependent(this._oScreenCallsDialog);
                    }

                    var oTable = this.byId(this.createId("screenCallsTable"));
                    oTable.getModel().setData(oData);
                    this._oScreenCallsDialog.open();
                }
            },

            onNodePress: function (oEvent) {
                var that = this,
                    oDoorType = "",
                    oNode = oEvent.getParameters().mProperties,
                    oSelectedData = this.getModel("TerminalData").getData().results.find(function (item) {
                        return item.LoadOrder === oNode.nodeId.split('_')[0];
                    });

                if (oNode.laneId === "2") {
                    if (!this._oDialogCI) {
                        var oTratorImage = !!oSelectedData.LogTrator,
                            oReboqueImage = !!oSelectedData.LogReboque;

                        this._oDialogCI = new sap.m.Dialog({
                            title: that.getResourceBundle().getText("confirmTransportPlate") + " - " + oSelectedData.LoadOrder,
                            contentWidth: "60%",
                            contentHeight: oTratorImage ? "40%" : "18%",
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
                                                                src: oSelectedData.LogTrator
                                                            })
                                                        ] : [
                                                            new sap.m.Text({
                                                                text: that.getResourceBundle().getText("tratorImageNotAvailable"),
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
                                                                src: oSelectedData.LogReboque
                                                            })
                                                        ] : [
                                                            new sap.m.Text({
                                                                text: that.getResourceBundle().getText("reboqueImageNotAvailable"),
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
                                            new sap.m.Label({ text: that.getResourceBundle().getText("plate") }),
                                            new sap.m.Input({
                                                id: "matricula",
                                                name: "matricula",
                                                width: "50%",
                                                showValueHelp: true,
                                                valueHelpRequest: that.onValueHelp.bind(that, "matricula"),
                                            }),
                                            new sap.ui.core.Title({ text: "" }),
                                            new sap.m.Label({ text: that.getResourceBundle().getText("trailerPlate") }),
                                            new sap.m.Input({
                                                id: "matriculareboque",
                                                name: "matriculareboque",
                                                width: "50%",
                                                showValueHelp: true,
                                                valueHelpRequest: that.onValueHelp.bind(that, "matriculareboque"),
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
                            text: that.getResourceBundle().getText("confirm"),
                            type: "Emphasized",
                            press: function () {
                                var oMatricula = sap.ui.getCore().byId("matricula").getValue(),
                                    oMatriculaReboque = sap.ui.getCore().byId("matriculareboque").getValue();

                                if (!oMatricula) {
                                    sap.m.MessageBox.warning(that.getResourceBundle().getText("pleaseFillTractorPlate"), {
                                        title: "Aviso",
                                        actions: [sap.m.MessageBox.Action.OK],
                                        emphasizedAction: sap.m.MessageBox.Action.OK
                                    });
                                    return;
                                }

                                if (!oMatriculaReboque) {
                                    sap.m.MessageBox.warning(that.getResourceBundle().getText("pleaseFillTrailerPlate"), {
                                        title: "Aviso",
                                        actions: [sap.m.MessageBox.Action.OK],
                                        emphasizedAction: sap.m.MessageBox.Action.OK
                                    });
                                    return;
                                }

                                that.onManagePlate(oSelectedData.LoadOrder, oSelectedData.PlateLog, "Confirm-CI");
                                that.onDestroyDialog("_oDialogCI");
                            }.bind(this)
                        }));

                        this._oDialogCI.addButton(new sap.m.Button({
                            id: "btDriverAssociate",
                            text: that.getResourceBundle().getText("associateDriver"),
                            type: "Emphasized",
                            press: function () {
                                if (!this._oAssociateDialog) {
                                    this._oAssociateDialog = new sap.m.Dialog({
                                        title: that.getResourceBundle().getText("associateDriverTitle") + " - " + oSelectedData.LoadOrder,
                                        contentWidth: "20%",
                                        contentHeight: "10%",
                                        content: new sap.ui.layout.form.SimpleForm({
                                            layout: "ResponsiveGridLayout",
                                            labelSpanXL: 4,
                                            labelSpanL: 4,
                                            labelSpanM: 4,
                                            labelSpanS: 4,
                                            columnsXL: 1,
                                            columnsL: 1,
                                            columnsM: 1,
                                            singleContainerFullSize: false,
                                            content: [
                                                new sap.m.Label({ text: that.getResourceBundle().getText("driver") }),
                                                new sap.m.Input({
                                                    id: "motorista",
                                                    width: "80%",
                                                    value: oSelectedData.Motorista,
                                                    showValueHelp: true,
                                                    valueHelpRequest: that.onValueHelp.bind(that, "motorista"),
                                                })
                                            ]
                                        }),
                                        buttons: [
                                            new sap.m.Button({
                                                text: that.getResourceBundle().getText("confirm"),
                                                type: "Emphasized",
                                                press: function () {
                                                    var sMotorista = sap.ui.getCore().byId("motorista").getValue();

                                                    if (!sMotorista) {
                                                        sap.m.MessageBox.warning(that.getResourceBundle().getText("pleaseAssociateDriver"), {
                                                            title: that.getResourceBundle().getText("warning"),
                                                            actions: [sap.m.MessageBox.Action.OK],
                                                            emphasizedAction: sap.m.MessageBox.Action.OK
                                                        });

                                                        return;
                                                    } else {
                                                        that.onAssociateDriver(oSelectedData.LoadOrder, sMotorista)
                                                    }
                                                }.bind(this)
                                            }),
                                            new sap.m.Button({
                                                text: that.getResourceBundle().getText("close"),
                                                press: function () {
                                                    this.onDestroyDialog("_oAssociateDialog");
                                                }.bind(this)
                                            })
                                        ]
                                    });

                                    this.getView().addDependent(this._oAssociateDialog);
                                }

                                this._oAssociateDialog.open();
                            }.bind(this)
                        }));

                        this._oDialogCI.addButton(new sap.m.Button({
                            text: that.getResourceBundle().getText("close"),
                            press: function () {
                                this.onDestroyDialog("_oDialogCI");
                            }.bind(this)
                        }));

                        this.getView().addDependent(this._oDialogCI);
                    }

                    if (oSelectedData.LogMatricula || oSelectedData.Matricula && oSelectedData.Reboque) {
                        if (oSelectedData.Matricula) {
                            sap.ui.getCore().byId("matricula").setValue(oSelectedData ? oSelectedData.Matricula : "");
                        } else if (oSelectedData.LogMatricula) {
                            sap.ui.getCore().byId("matricula").setValue(oSelectedData ? oSelectedData.LogMatricula : "");
                        }
                        sap.ui.getCore().byId("matriculareboque").setValue(oSelectedData ? oSelectedData.Reboque : "");
                    }
                    this._oDialogCI.open();
                } else if (oNode.laneId === "5" || oNode.laneId === "6" || oNode.laneId === "9") {
                    if (!this._oDialog) {
                        if (oNode.laneId == "5") {
                            oDoorType = "INGOBAY"
                        } else {
                            oDoorType = "INCHECKOUT"
                        }

                        var oLanes = {
                            "5": {
                                property: "LogQueue",
                                errorMessage: that.getResourceBundle().getText("errorMessageQueue")
                            },
                            "6": {
                                property: "LogBay",
                                errorMessage: that.getResourceBundle().getText("errorMessageBay")
                            },
                            "9": {
                                property: "LogCheckOut",
                                errorMessage: that.getResourceBundle().getText("errorMessageCheckOut")
                            }
                        };

                        var oLane = oLanes[oNode.laneId],
                            oImage = !!oSelectedData[oLane.property];

                        this._oDialog = new sap.m.Dialog({
                            title: that.getResourceBundle().getText("confirmTransportPlate") + " - " + oSelectedData.LoadOrder,
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
                                                                id: "imagem",
                                                                width: "450px",
                                                                height: "250px",
                                                                src: oSelectedData[oLane.property]
                                                            })
                                                        ] : [
                                                            new sap.m.Text({
                                                                text: that.getResourceBundle().getText("imageNotAvailable"),
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
                                            new sap.m.Label({ text: that.getResourceBundle().getText("plate") }),
                                            new sap.m.Input({
                                                id: "matricula",
                                                name: "matricula",
                                                width: "50%",
                                                showValueHelp: true,
                                                valueHelpRequest: that.onValueHelp.bind(that, "matricula"),
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
                            text: that.getResourceBundle().getText("changeBay"),
                            type: "Reject",
                            visible: oNode.laneId === "6" ? true : false,
                            press: function () {
                                sap.m.MessageBox.warning(that.getResourceBundle().getText("changeBayConfirm") + " - " + oSelectedData.LoadOrder, {
                                    title: that.getResourceBundle().getText("changeBay"),
                                    actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                                    emphasizedAction: sap.m.MessageBox.Action.OK,
                                    onClose: function (oAction) {
                                        if (oAction === sap.m.MessageBox.Action.OK) {
                                            that.onChangeBayCall(oSelectedData.LoadOrder, "", 'Erro');
                                        }
                                    }
                                });
                            }.bind(this)
                        }));

                        this._oDialog.addButton(new sap.m.Button({
                            text: that.getResourceBundle().getText("printDocuments"),
                            visible: oNode.laneId === "9" ? true : false,
                            type: "Reject",
                            press: function () {
                                that.onPrintAttachments(oSelectedData.LoadOrder);
                                this.onDestroyDialog("_oDialog");
                            }.bind(this)
                        }));

                        this._oDialog.addButton(new sap.m.Button({
                            text: that.getResourceBundle().getText("confirm"),
                            type: "Emphasized",
                            press: function () {
                                that.onManagePlate(oSelectedData.LoadOrder, oSelectedData.PlateLog, "Confirm" + oNode.titleAbbreviation);
                                this.onDestroyDialog("_oDialog");
                            }.bind(this)
                        }));

                        // this._oDialog.addButton(new sap.m.Button({
                        //     text: that.getResourceBundle().getText("executeRead"),
                        //     type: "Emphasized",
                        //     press: function () {
                        //         that.onManagePlate(oSelectedData.LoadOrder, oSelectedData.PlateLog, oNode.titleAbbreviation);
                        //         this.onDestroyDialog("_oDialog");
                        //     }.bind(this)
                        // }));

                        this._oDialog.addButton(new sap.m.Button({
                            text: that.getResourceBundle().getText("openBarrier"),
                            visible: oNode.laneId === "9" || oNode.laneId === "5",
                            type: "Emphasized",
                            press: function () {
                                that.onOpenBarreira(oSelectedData.LoadOrder, oDoorType);
                                that.onDestroyDialog("_oDialog");
                            }.bind(this)
                        }));

                        this._oDialog.addButton(new sap.m.Button({
                            text: that.getResourceBundle().getText("close"),
                            press: function () {
                                this.onDestroyDialog("_oDialog");
                            }.bind(this)
                        }));

                        this.getView().addDependent(this._oDialog);
                    }

                    if (oLane) {
                        var oPlate = sap.ui.getCore().byId("matricula"),
                            oImage = sap.ui.getCore().byId("imagem");

                        if (oPlate) {
                            var matriculaValue = oSelectedData ? (oNode.state === "Positive" ? oSelectedData.Matricula : oSelectedData.LogMatricula) : "";
                            oPlate.setValue(matriculaValue);
                        }
                        if (oImage) {
                            oImage.setSrc(oSelectedData[oLane.property]);
                        }
                        this._oDialog.open();
                    }

                } else if (oNode.laneId === "4") {
                    if (oNode.state === "Critical") {
                        new sap.m.MessageBox.warning(that.getResourceBundle().getText("executeCallConfirmAgain") + " - " + oSelectedData.LoadOrder, {
                            title: that.getResourceBundle().getText("executeCall"),
                            actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                            onClose: function (oAction) {
                                if (oAction === sap.m.MessageBox.Action.OK) {
                                    that.onManagePlate(oSelectedData.LoadOrder, oSelectedData.PlateLog, oNode.titleAbbreviation);
                                }
                            }
                        });
                    } else {
                        if (!this._oDialog) {
                            var oSimpleForm = new sap.ui.layout.form.SimpleForm({
                                layout: "ResponsiveGridLayout",
                                labelSpanXL: 4,
                                labelSpanL: 4,
                                labelSpanM: 4,
                                labelSpanS: 4,
                                columnsXL: 1,
                                columnsL: 1,
                                columnsM: 1,
                                singleContainerFullSize: false,
                                content: [
                                    new sap.m.Label({ text: that.getResourceBundle().getText("loadingIsland") }),
                                    new sap.m.Select({
                                        id: this.createId("bay"),
                                        width: "80%",
                                        selectedKey: oSelectedData.IlhaDeCarga,
                                        items: [
                                            new sap.ui.core.Item({ key: "1", text: "Ilha 1" }),
                                            new sap.ui.core.Item({ key: "2", text: "Ilha 2" }),
                                            new sap.ui.core.Item({ key: "3", text: "Ilha 3" }),
                                            new sap.ui.core.Item({ key: "4", text: "Ilha 4" }),
                                            new sap.ui.core.Item({ key: "5", text: "Ilha 5" })
                                        ]
                                    })
                                ]
                            });

                            this._oDialog = new sap.m.Dialog({
                                title: that.getResourceBundle().getText("callManagement") + " - " + oSelectedData.LoadOrder,
                                contentWidth: "23%",
                                contentHeight: "10%",
                                content: oSimpleForm,
                                buttons: [
                                    new sap.m.Button({
                                        text: that.getResourceBundle().getText("change"),
                                        type: "Emphasized",
                                        press: function () {
                                            var sBay = that.byId(that.createId("bay")).getSelectedKey();

                                            if (sBay === oSelectedData.IlhaDeCarga) {
                                                sap.m.MessageBox.error(that.getResourceBundle().getText("bayCannotBeEqual"), {
                                                    title: that.getResourceBundle().getText("changeCall"),
                                                    actions: [sap.m.MessageBox.Action.OK],
                                                    emphasizedAction: sap.m.MessageBox.Action.OK,
                                                });
                                            } else {
                                                sap.m.MessageBox.warning(that.getResourceBundle().getText("changeCallConfirm") + " - " + oSelectedData.LoadOrder, {
                                                    title: that.getResourceBundle().getText("changeCall"),
                                                    actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                                                    emphasizedAction: sap.m.MessageBox.Action.OK,
                                                    onClose: function (oAction) {
                                                        if (oAction === sap.m.MessageBox.Action.OK) {
                                                            that.onChangeBayCall(oSelectedData.LoadOrder, sBay);
                                                        }
                                                    }
                                                });
                                            }
                                        }.bind(this)
                                    }),
                                    new sap.m.Button({
                                        text: that.getResourceBundle().getText("close"),
                                        press: function () {
                                            this.onDestroyDialog("_oDialog");
                                        }.bind(this)
                                    })
                                ],
                                afterClose: function () {
                                    this.onDestroyDialog("_oDialog");
                                }.bind(this)
                            });

                            this.getView().addDependent(this._oDialog);
                            this._oDialog.open();
                        }
                    }
                } else if (oNode.laneId === "3" && oSelectedData.Incall === "") {
                    new sap.m.MessageBox.warning(that.getResourceBundle().getText("executeCallConfirm") + " - " + oSelectedData.LoadOrder, {
                        title: that.getResourceBundle().getText("executeCall"),
                        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                        emphasizedAction: sap.m.MessageBox.Action.OK,
                        onClose: function (oAction) {
                            if (oAction === sap.m.MessageBox.Action.OK) {
                                that.onManagePlate(oSelectedData.LoadOrder, oSelectedData.PlateLog, "Confirm" + oNode.titleAbbreviation);
                            }
                        }
                    });
                } else if (oNode.laneId === "1") {
                    try {
                        var oModifications = JSON.parse(oSelectedData.ModLogs),
                            aModifications = [],
                            oTexts = {
                                MANUAL_CREATED: that.getResourceBundle().getText("manualCreated"),
                                DRIVER_ASSOCIATE: that.getResourceBundle().getText("driverAssociate"),
                                CONFIRM_PLATE_INCHECKIN: that.getResourceBundle().getText("confirmPlateInCheckIn"),
                                CONFIRM_PLATE_INGOBAY: that.getResourceBundle().getText("confirmPlateInGoBay"),
                                CONFIRM_PLATE_INBAY: that.getResourceBundle().getText("confirmPlateInBay"),
                                CONFIRM_PLATE_INCHECKOUT: that.getResourceBundle().getText("confirmPlateInCheckOut"),
                                CALL_EXECUTE: that.getResourceBundle().getText("callExecute"),
                                CHANGE_BAY: that.getResourceBundle().getText("changeBay"),
                                OPEN_BARRIER: that.getResourceBundle().getText("openBarrier"),
                                PRINT: that.getResourceBundle().getText("printDocuments2"),
                            };

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

                        if (aModifications.length > 0) {
                            if (!this._oModificationsDialog) {
                                this._oModificationsDialog = new sap.m.Dialog({
                                    title: that.getResourceBundle().getText("operations"),
                                    contentWidth: "40%",
                                    contentHeight: "30%",
                                    content: [
                                        new sap.m.Table({
                                            id: this.createId("modificationsTable"),
                                            columns: [
                                                new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("action") }) }),
                                                new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("madeby") }) }),
                                                new sap.m.Column({ header: new sap.m.Label({ text: that.getResourceBundle().getText("timestamp") }) })
                                            ]
                                        }).setModel(new sap.ui.model.json.JSONModel({ Modifications: aModifications })).bindItems({
                                            path: "/Modifications",
                                            template: new sap.m.ColumnListItem({
                                                cells: [
                                                    new sap.m.Text({
                                                        text: {
                                                            path: "Action",
                                                            formatter: function (sAction) {
                                                                return oTexts[sAction] || sAction;
                                                            }
                                                        }
                                                    }),
                                                    new sap.m.Text({ text: "{User}" }),
                                                    new sap.m.Text({ text: "{Timestamp}" })
                                                ]
                                            })
                                        })
                                    ],
                                    beginButton: new sap.m.Button({
                                        text: that.getResourceBundle().getText("close"),
                                        press: function () {
                                            this._oModificationsDialog.close();
                                        }.bind(this)
                                    }),
                                    afterClose: function () {
                                        this.onDestroyDialog("_oModificationsDialog");
                                    }.bind(this)
                                });

                                this.getView().addDependent(this._oModificationsDialog);
                            }

                            var oTable = this.byId(this.createId("modificationsTable"));
                            oTable.getModel().setData({ Modifications: aModifications });

                            this._oModificationsDialog.open();
                        } else {
                            new sap.m.MessageBox.warning(that.getResourceBundle().getText("noModifications"), {
                                title: that.getResourceBundle().getText("noModificationsTitle"),
                                actions: [sap.m.MessageBox.Action.OK],
                                emphasizedAction: sap.m.MessageBox.Action.OK,
                            });
                        }
                    } catch (error) {
                        var oMessage = {
                            oText: error.message,
                            oTitle: this.getResourceBundle().getText("error")
                        };

                        this.showErrorMessage(oMessage);
                    }
                }
            },

            // LOADS MADE *********************************************************************************************
            onBindShipmentsData: function (oData) {
                if (oData) {
                    if (this.getModel("LoadsMade").getData().length > 0) {
                        this.getModel("LoadsMade").setData(null);
                    }

                    var oModel = this.getModel("LoadsMade");
                    oModel.setData({ oData });
                }
            },

            onFilterShipmentsData: function (oDatePickerId, oTableId) {
                var oDate = this.byId(oDatePickerId).getDateValue();

                if (oDate) {
                    var oStartDate = new Date(oDate);
                    oStartDate.setHours(0, 0, 0, 0);

                    var oEndDate = new Date(oDate);
                    oEndDate.setHours(23, 59, 59, 999);

                    var oDateFilter = new Filter({ path: "dataprevistacarregamento", operator: FilterOperator.BT, value1: oStartDate, value2: oEndDate });
                }

                if (oTableId === "madeTable") {
                    var oShipTypeMade = new Filter("estado", FilterOperator.EQ, "3");

                    this.byId(oTableId).getBinding("items").filter([oShipTypeMade, oDateFilter]);
                } else {
                    var oShipTypeOutLoads = new Filter({
                        filters: [
                            new Filter("estado", FilterOperator.EQ, "1"),
                            new Filter("estado", FilterOperator.EQ, "2")
                        ],
                        and: false
                    });

                    this.byId(oTableId).getBinding("items").filter([oDateFilter, oShipTypeOutLoads]);
                }
            },

            onShipmentSelect: function (oEvent) {
                var oContext = oEvent.getSource().getBindingContext(),
                    sPathLoads = oContext.getPath();

                this.onNavigation(sPathLoads, "shipsdetail", "/xTQAxMADED_LOADS_DD");
            },

            handleShipmentSuccess: function (oResponse) {
                var that = this;
                var aSortedResults = oResponse.results.sort(function (a, b) {
                    return a.codcompartimento.localeCompare(b.codcompartimento, undefined, { numeric: true });
                });

                var fTotalProdComercial = aSortedResults.reduce(function (acc, item) {
                    return acc + parseFloat(item.quantprodcomercial || 0);
                }, 0);

                var fTotalConfirmada = aSortedResults.reduce(function (acc, item) {
                    return acc + parseFloat(item.quantconfirmada || 0);
                }, 0);

                var oLoadsDetails = new sap.ui.model.json.JSONModel();
                oLoadsDetails.setData({
                    results: aSortedResults,
                    totais: {
                        quantprodcomercial: fTotalProdComercial.toFixed(2),
                        quantconfirmada: fTotalConfirmada.toFixed(2)
                    }
                });

                that.byId("shipmentsDetailsTable").setModel(oLoadsDetails, "LoadsDetails");
            },

            // FUNÇÕES GLOBAIS (CIRCUITO) ****************************************
            onValueHelpRequest: function (vhPath, oEvent) {
                this._oInputSource = oEvent.getSource();
                var oInput = oEvent.getSource(),
                    oBindingContext = oInput.getBindingContext(),
                    sValueForFilter = oBindingContext.getProperty(oInput.getBindingPath('value'));

                this._oValueHelpContext = {
                    inputSource: oInput,
                    rowIndex: oBindingContext.getPath().split("/").pop(),
                    columnName: oInput.getBindingPath('value'),
                    material: ""
                };

                if (!this.oDefaultDialog) {
                    this.oDefaultDialog = new sap.m.SelectDialog({
                        id: "Vh",
                        multiSelect: false,
                        rememberSelections: true,
                        selectionChange: this.onChangeValueHelp.bind(this, vhPath),
                    });

                    this.getView().addDependent(this.oDefaultDialog);
                }

                switch (vhPath) {
                    case 'BAYS':
                        this.oDefaultDialog.setTitle("Estado Ilhas");
                        var aItems = [
                            { title: "Disponível", description: "1" },
                            { title: "Indisponível", description: "2" },
                            { title: "Em Manutenção", description: "3" }
                        ];

                        this.oDefaultDialog.removeAllItems();

                        aItems.forEach(function (oItem) {
                            this.oDefaultDialog.addItem(new sap.m.StandardListItem({
                                title: oItem.title,
                                description: oItem.description
                            }));
                        }, this);
                        break;

                    case 'TANKS':
                        this.oDefaultDialog.setTitle(this.getResourceBundle().getText("tankExpedition"));
                        this.oDefaultDialog.removeAllItems();

                        var oTemplate = new sap.m.StandardListItem({
                            title: "{tank}",
                            description: "{desc_material} ({lgobe})"
                        });

                        var oBindingInfo = {
                            path: "/xTQAxTANKS_VH",
                            template: oTemplate
                        };

                        this.oDefaultDialog.bindAggregation("items", oBindingInfo);

                        if (sValueForFilter && sValueForFilter.Material) {
                            this._oValueHelpContext.material = sValueForFilter.Material;

                            var oFilter = new sap.ui.model.Filter("material", sap.ui.model.FilterOperator.Contains, sValueForFilter.Material),
                                oBinding = this.oDefaultDialog.getBinding("items");

                            oBinding.filter([oFilter]);
                        }
                        break;
                    case 'TANKS_STATE':
                        this.oDefaultDialog.setTitle(this.getResourceBundle().getText("tankState"));
                        this.oDefaultDialog.removeAllItems();

                        var oTemplate = new sap.m.StandardListItem({
                            title: "{status}",
                            description: "{domvalue_l}"
                        });

                        var oBindingInfo = {
                            path: "/xTQAxTANKS_STATUS_VH",
                            template: oTemplate
                        };

                        this.oDefaultDialog.bindAggregation("items", oBindingInfo);

                }

                this.oDefaultDialog.open();
            },

            onChangeValueHelp: function (vhPath, oEntityProperties) {
                var oSelectedItem = oEntityProperties.mParameters.listItem.mProperties;

                if (!oSelectedItem || !this._oInputSource) {
                    return;
                }

                var oIlha = +this._oValueHelpContext.rowIndex + 1,
                    oBraco = this._oValueHelpContext.columnName,
                    oEntry = {};

                switch (vhPath) {
                    case 'BAYS':
                        oEntry.Braco = this._oValueHelpContext.columnName.replace('Braco', '').trim();
                        oEntry.EstadoIlha = oSelectedItem.description;
                        this.onUpdateBays(oIlha, oEntry);
                        break;

                    case 'TANKS':
                        oEntry.Braco = oBraco;
                        oEntry.Tank = oSelectedItem.title;
                        oEntry.Material = this._oValueHelpContext.material;
                        this.onUpdateTank(oIlha, oEntry);
                        break;

                    case 'TANKS_STATE':
                        oEntry.status = oSelectedItem.description;
                        this.onUpdateTankState(this._oValueHelpContext.rowIndex, oEntry);
                        break;
                }
            },

            onSearchValueHelp: function (oEntityProperties) {
                var sValue = oEntityProperties.getParameter("value"),
                    oFilter = new sap.ui.model.Filter("lgort", sap.ui.model.FilterOperator.Contains, sValue),
                    oBinding = oEntityProperties.getSource().getBinding("items");

                oBinding.filter([oFilter]);
            },

            onCallPopup: function () {
                new sap.m.MessageBox.error(this.getResourceBundle().getText("notPossible"), {
                    title: this.getResourceBundle().getText("queueChange"),
                    actions: [sap.m.MessageBox.Action.OK],
                    emphasizedAction: sap.m.MessageBox.Action.OK,
                });
            },

            handleCreateTrace: function () {
                var that = this,
                    _oDialogCreateTrace = new sap.m.Dialog({
                        title: that.getResourceBundle().getText("createCheckInManualTitle"),
                        contentWidth: "530px",
                        contentHeight: "100px",
                        content: [
                            new sap.m.VBox({
                                items: [
                                    new sap.m.Label({
                                        text: that.getResourceBundle().getText("pleaseInsertLoadOrder"),
                                        width: '100%'
                                    }),
                                    new sap.m.Input({
                                        id: "loadorderInput",
                                        type: sap.m.InputType.Number,
                                        placeholder: that.getResourceBundle().getText("loadOrder"),
                                        width: '100%',
                                    })
                                ],
                                justifyContent: "Center",
                                alignItems: "Center",
                                width: "100%"
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: that.getResourceBundle().getText("add"),
                            type: "Emphasized",
                            press: function () {
                                var sLoadOrder = sap.ui.getCore().byId('loadorderInput').getValue();
                                that.onCreateTrace(sLoadOrder);
                                _oDialogCreateTrace.close();
                            }
                        }),
                        endButton: new sap.m.Button({
                            text: that.getResourceBundle().getText("close"),
                            press: function () {
                                _oDialogCreateTrace.close();
                            }
                        }),
                        afterClose: function () {
                            _oDialogCreateTrace.destroy();
                        }
                    });

                _oDialogCreateTrace.open();
            },
        });
    });
