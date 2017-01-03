"use strict";

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
        Schema = mongoose.Schema,
        timestamps = require('mongoose-timestamp');

var DataTable = require('mongoose-datatable');

DataTable.configure({
    verbose: false,
    debug: false
});
mongoose.plugin(DataTable.init);

var Dict = INCLUDE('dict');

var setPrice = function (value) {
    return MODULE('utils').setPrice(value);
};

/**
 * Article Schema
 */
var deliverySchema = new Schema({
    ref: {type: String, unique: true},
    type: {type: String, default: 'DELIVERY_STANDARD'},
    title: {//For internal use only
        ref: String,
        autoGenerated: {type: Boolean, default: false} //For automatic process generated deliveries
    },
    Status: {type: String, default: 'DRAFT'},
    cond_reglement_code: {type: String, default: '30D'},
    mode_reglement_code: {type: String, default: 'CHQ'},
    isremoved : Boolean,
    //bank_reglement: {type: String},
    client: {
        id: {type: Schema.Types.ObjectId, ref: 'societe'},
        name: String,
        isNameModified: {type: Boolean},
        cptBilling: {id: {type: Schema.Types.ObjectId, ref: 'societe'}, name: String}
    },
    billing: {
        societe: {
            id: {
                type: Schema.Types.ObjectId,
                ref: 'societe'
            },
            name: String
        },
        contact: String,
        address: String,
        zip: String,
        town: String,
        country: String
    },
    contacts: [{
            type: Schema.Types.ObjectId,
            ref: 'contact'
        }],
    ref_client: {type: String, default: ""},
    price_level: {type: String, default: "BASE", uppercase: true, trim: true},
    name: String,
    address: String,
    zip: String,
    town: String,
    country_id: {type: String, default: 'FR'},
    state_id: Number,
    phone: String,
    email: String,
    datec: {type: Date, default: Date.now}, // date de creation
    datedl: {type: Date, default: Date.now}, // date d'expedition
    dater: {type: Date}, // Date de reception
    dateOf: {type: Date}, // date de debut de prestation
    dateTo: {type: Date}, // date de fin de prestation
    notes: [{
            title: String,
            note: String,
            public: {
                type: Boolean,
                default: false
            },
            edit: {
                type: Boolean,
                default: false
            }
        }],
    total_ht: {type: Number, default: 0, set: setPrice},
    total_tva: [
        {
            tva_tx: Number,
            total: {type: Number, default: 0}
        }
    ],
    total_ttc: {type: Number, default: 0},
    total_ht_subcontractors: {type: Number, default: 0},
    delivery_mode: String,
    transport: String,
    tracking: String,
    shipping: {
        total_ht: {type: Number, default: 0, set: setPrice},
        tva_tx: {type: Number, default: 20},
        total_tva: {type: Number, default: 0}
    },
    author: {id: String, name: String},
    controlledBy: {id: String, name: String},
    commercial_id: {id: {type: String}, name: String},
    entity: {type: String},
    modelpdf: String,
    order: {type: Schema.Types.ObjectId, ref: 'order'},
    bill: {type: Schema.Types.ObjectId, ref: 'bill'},
    //orders: [{type: Schema.Types.ObjectId, ref: 'commande'}], // A supprimer plus tard
    //groups: [Schema.Types.Mixed],
    weight: {type: Number, default: 0}, // Poids total
    lines: [{
            group: {type: String, default: "1. DEFAULT"},
            title: String,
            description: {type: String, default: ""},
            product_type: String,
            product: {
                id: {type: Schema.Types.ObjectId, ref: "product"},
                name: {type: String},
                label: String,
                unit: String,
                dynForm: String
                        //  family: {type: String, uppercase: true, default: "OTHER"}
            },
            qty: {type: Number, default: 0},
            priceSpecific: {type: Boolean, default: false},
            pu_ht: Number,
            tva_tx: Number,
            total_tva: Number,
            total_ht: {type: Number, set: setPrice},
            discount: {type: Number, default: 0},
            no_package: Number, // Colis Number TODO a supprimer
            qty_order: {type: Number, default: 0},
            weight: {type: Number, default: 0}
        }],
    subcontractors: [{
            title: String,
            description: {type: String, default: ""},
            product_type: String,
            product: {
                id: {type: Schema.Types.ObjectId, ref: "Product"},
                name: {type: String},
                label: String,
                unit: String
            },
            societe: {
                id: {type: Schema.Types.ObjectId, ref: 'Societe'},
                name: String
            },
            qty: {type: Number, default: 0},
            priceSpecific: {type: Boolean, default: false},
            pu_ht: Number,
            tva_tx: Number,
            total_tva: Number,
            total_ht: {type: Number, set: setPrice},
            discount: {type: Number, default: 0},
            qty_order: {type: Number, default: 0}
        }],
    history: [{
            date: {type: Date, default: Date.now},
            author: {
                id: String,
                name: String
            },
            mode: String, //email, order, alert, new, ...
            Status: String,
            msg: String
        }],
    feeDelivering: {type: Boolean, default: true} // Frais de facturation
}, {
    toObject: {virtuals: true},
    toJSON: {virtuals: true}
});

deliverySchema.plugin(timestamps);

/**
 * Pre-save hook
 */
deliverySchema.pre('save', function (next) {
    var SeqModel = MODEL('Sequence').Schema;
    var EntityModel = MODEL('entity').Schema;

    this.total_ht = 0;
    this.total_tva = [];
    this.total_ttc = 0;
    this.total_ht_subcontractors = 0;
    this.weight = 0;
    
    if(!this.name)
        this.name = this.client.name;

    if (this.isNew)
        this.history = [];

    var i, j, length, found;
    var subtotal = 0;

    for (i = 0, length = this.lines.length; i < length; i++) {
        // SUBTOTAL
        if (this.lines[i].product.name == 'SUBTOTAL') {
            this.lines[i].total_ht = subtotal;
            subtotal = 0;
            continue;
        }

        //console.log(object.lines[i].total_ht);
        this.total_ht += this.lines[i].total_ht;
        subtotal += this.lines[i].total_ht;
        //this.total_ttc += this.lines[i].total_ttc;
        //Add VAT
        found = false;
        for (j = 0; j < this.total_tva.length; j++)
            if (this.total_tva[j].tva_tx === this.lines[i].tva_tx) {
                this.total_tva[j].total += this.lines[i].total_tva;
                found = true;
                break;
            }

        if (!found) {
            this.total_tva.push({
                tva_tx: this.lines[i].tva_tx,
                total: this.lines[i].total_tva
            });
        }
        
        if(this.lines[i].product.id && this.lines[i].product.id.weight)
            this.lines[i].weight = this.lines[i].product.id.weight;

        //Poids total
        this.weight += this.lines[i].weight * this.lines[i].qty;
    }

    // shipping cost
    if (this.shipping.total_ht) {
        this.total_ht += this.shipping.total_ht;

        this.shipping.total_tva = this.shipping.total_ht * this.shipping.tva_tx / 100;

        //Add VAT
        found = false;
        for (j = 0; j < this.total_tva.length; j++)
            if (this.total_tva[j].tva_tx === this.shipping.tva_tx) {
                this.total_tva[j].total += this.shipping.total_tva;
                found = true;
                break;
            }

        if (!found) {
            this.total_tva.push({
                tva_tx: this.shipping.tva_tx,
                total: this.shipping.total_tva
            });
        }
    }

    this.total_ht = MODULE('utils').round(this.total_ht, 2);
    //this.total_tva = Math.round(this.total_tva * 100) / 100;
    this.total_ttc = this.total_ht;

    for (j = 0; j < this.total_tva.length; j++) {
        this.total_tva[j].total = MODULE('utils').round(this.total_tva[j].total, 2);
        this.total_ttc += this.total_tva[j].total;
    }


    for (i = 0, length = this.subcontractors.length; i < length; i++)
        this.total_ht_subcontractors += this.subcontractors[i].total_ht;

    var self = this;
    if (this.isNew) {
        SeqModel.inc("BL", function (seq) {
            //console.log(seq);
            self.ref = "BL" + seq;
            next();
        });
    } else {
        if (this.Status !== "DRAFT" && this.ref.substr(0, 4) === "BL") {
            EntityModel.findOne({_id: self.entity}, "cptRef", function (err, entity) {
                if (err)
                    console.log(err);

                if (entity && entity.cptRef) {
                    SeqModel.inc("BL" + entity.cptRef, self.datec, function (seq) {
                        //console.log(seq);
                        self.ref = "BL" + entity.cptRef + seq;
                        next();
                    });
                } else {
                    SeqModel.inc("BL", self.datec, function (seq) {
                        //console.log(seq);
                        self.ref = "BL" + seq;
                        next();
                    });
                }
            });
        } else {
            self.ref = F.functions.refreshSeq(self.ref, self.datedl);
            next();
        }
    }
//    EntityModel.findOne({_id: self.entity}, "cptRef", function(err, entity) {
//        if (err)
//            console.log(err);
//
//        if (entity && entity.cptRef) {
//            SeqModel.inc("BL" + entity.cptRef, self.datec, function(seq) {
//                //console.log(seq);
//                self.ref = "BL" + entity.cptRef + seq;
//                next();
//            });
//        } else {
//            SeqModel.inc("BL", self.datec, function(seq) {
//                //console.log(seq);
//                self.ref = "BL" + seq;
//                next();
//            });
//        }
//    });

});

/**
 * Methods
 */
deliverySchema.methods = {
    /**
     * inc - increment delivery Number
     *
     * @param {function} callback
     * @api public
     */
    setNumber: function () {
        var self = this;
        if (this.ref.substr(0, 4) === "PROV")
            SeqModel.inc("FA", function (seq) {
                //console.log(seq);
                self.ref = "FA" + seq;
            });
    }
};

var statusList = {};
Dict.dict({dictName: 'fk_delivery_status', object: true}, function (err, doc) {
    if (err) {
        console.log(err);
        return;
    }
    statusList = doc;
});

deliverySchema.virtual('status')
        .get(function () {
            var res_status = {};

            var status = this.Status;

            if (status && statusList.values[status] && statusList.values[status].label) {
                //console.log(this);
                res_status.id = status;
                res_status.name = i18n.t("deliveries:" + statusList.values[status].label);
                //res_status.name = statusList.values[status].label;
                res_status.css = statusList.values[status].cssClass;
            } else { // By default
                res_status.id = status;
                res_status.name = status;
                res_status.css = "";
            }
            return res_status;

        });


exports.Schema = mongoose.model('delivery', deliverySchema, 'Delivery');
exports.name = 'delivery';
