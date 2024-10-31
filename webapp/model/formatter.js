sap.ui.define([], function () {
    "use strict";

    return {
        dateFormat: function (oDate) {
            if (oDate != null) {
                var oDate = (oDate instanceof Date) ? oDate : new Date(oDate);
                var dateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "dd.MM.yyyy HH:mm" });

                return dateFormat.format(oDate);
            }
        },

        removeZerosCompartment: function (sValue) {
            if (sValue) {
                return sValue.replace(/^0+/, '');
            }
            return sValue;
        },

        _emptyColumn: function (oBraco) {
            if (oBraco == null) {
                return ""
            } else {
                return oBraco.Descricao;
            }
        },

        _loadState: function (oState) {
            if (oState) {
                switch (oState.EstadoIlha) {
                    case "1":
                        return "Disponível"
                    case "2":
                        return "Indisponível"
                    case "3":
                        return "Em Manutenção"
                }
            }
        },

        loadState: function (oState) {
            if (oState == null) {
                return this.getResourceBundle().getText("unavailable")
            } else if (oState == "1") {
                return this.getResourceBundle().getText("available")
            } else if (oState == "2") {
                return this.getResourceBundle().getText("unavailable")
            } else if (oState == "3") {
                return this.getResourceBundle().getText("maintenance")
            }
        },

        armState: function (oState) {
            if (oState) {
                if (oState.EstadoIlha == "2") {
                    return "Error"
                } else if (oState.EstadoIlha == "3") {
                    return "Warning"
                }
            }
        },

        statusState: function (oState) {
            if (oState) {
                if (oState == "2") {
                    return "Error"
                } else if (oState == "3") {
                    return "Warning"
                }
            }
        },

        highlightState: function (oHighlightState) {
            if (oHighlightState == null) {
                return "Error"
            } else if (oHighlightState == "1") {
                return "Success"
            } else if (oHighlightState == "2") {
                return "Error"
            } else if (oHighlightState == "3") {
                return "Warning"
            }
        },

        emptyTankColumn: function (oTank) {
            if (oTank == null) {
                return ""
            } else {
                return oTank.Tank + " (" + oTank.Descricao + ")";
            }
        },

        visibleTankColumn: function (oTank) {
            return !!oTank;
        },

        stateFormatter: function (oState) {
            if (oState) {
                switch (oState) {
                    case "1":
                        return "Information";
                    case "2":
                        return "Success";
                    case "3":
                        return "Success";
                    case "4":
                        return "Error";;
                }
            }
        },

        toFloat: function (oValue) {
            return parseFloat(oValue);
        },

        formatAction: function (sAction) {
            if (sAction) {
                var oTexts = {
                    MANUAL_CREATED: "Criado Manualmente",
                    DRIVER_ASSOCIATE: "Associação de Motorista",
                    CONFIRM_PLATE_INCHECKIN: "Confirmação Matrícula Check-In",
                    CONFIRM_PLATE_INGOBAY: "Confirmação Matrícula Fila Espera",
                    CONFIRM_PLATE_INBAY: "Confirmação Matrícula Ilha de Carga",
                    CONFIRM_PLATE_INCHECKOUT: "Confirmação Matrícula Check-Out",
                    CALL_EXECUTE: "Execução de Chamada",
                    CHANGE_BAY: "Alteração de Ilha de Carga",
                    OPEN_BARRIER: "Abertura de Barreira",
                    PRINT: "Impressão dos Documentos"
                };
                return oTexts[sAction] || sAction;
            }
        },

        formatBay: function (oBay) {
            if (oBay == "0") {
                return ""
            } else {
                return oBay;
            }
        }

    };
});