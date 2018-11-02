import React from "react";

import {
  get_utxos,
  generateSafexBtcTransaction,
  broadcastTransaction,
  BURN_ADDRESS,
  setSafexMigrationAddress,
  getFee
} from "../../utils/migration";

import {
  openMigrationAlert,
  closeMigrationAlert,
  openResetMigration,
  closeResetMigration,
  confirmReset
} from "../../utils/modals";

import MigrationAlert from "../partials/MigrationAlert";
import ConfirmMigration from "../partials/ConfirmMigration";

//Burn Safe Exchange Coins
export default class Migrate5 extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      safex_key: this.props.data.safex_key,
      loading: true,
      address: this.props.data.address,
      wif: this.props.data.wif,
      safex_bal: 0,
      pending_safex_bal: 0,
      btc_bal: 0,
      pending_btc_bal: 0,
      safex_price: 0,
      btc_price: 0,
      status_text: "",
      txn_fee: 0,
      migration_alert: false,
      migration_alert_text: "",
      migration_complete: false,
      fee: this.props.data.fee,
      confirm_migration: false
    };

    this.burnSafex = this.burnSafex.bind(this);
    this.validateAmount = this.validateAmount.bind(this);
    this.setOpenMigrationAlert = this.setOpenMigrationAlert.bind(this);
    this.setCloseMigrationAlert = this.setCloseMigrationAlert.bind(this);
    this.toggleConfirmMigration = this.toggleConfirmMigration.bind(this);
  }

  componentDidMount() {
    this.getBalances(this.props.data.address);
    this.getTxnFee();
    this.setState({ loading: false });
  }

  getTxnFee() {
    //public spend key is first half
    get_utxos(this.props.data.address)
      .then(utxos => {
        const rawtx = generateSafexBtcTransaction(
          utxos,
          BURN_ADDRESS,
          this.state.wif,
          1,
          this.props.data.fee
        );
        this.setState({ txn_fee: rawtx.fee / 100000000 });
      })
      .catch(err => console.log(err));
  }

  getBalances(address) {
    var promises = [];
    var json = {};
    json["address"] = address;
    promises.push(
      fetch("http://omni.safex.io:3001/balance", {
        method: "POST",
        body: JSON.stringify(json)
      })
        .then(resp => resp.json())
        .then(resp => {
          return resp;
        })
    );
    promises.push(
      fetch(
        "http://bitcoin.safex.io:3001/insight-api/addr/" + address + "/balance"
      )
        .then(resp => resp.text())
        .then(resp => {
          return resp;
        })
    );

    Promise.all(promises)
      .then(values => {
        this.setState({
          safex_bal: values[0].balance,
          btc_bal: (values[1] / 100000000).toFixed(8),
          safex_price: localStorage.getItem("safex_price"),
          btc_price: localStorage.getItem("btc_price")
        });
      })
      .catch(e => {
        console.log(e);
        this.setState({
          status_text: "Sync error, please refresh"
        });
      });
  }

  burnSafex(e) {
    e.preventDefault();
    const amount_value = document.getElementById("amount").value;
    const amount = parseInt(amount_value);
    if (amount === "") {
      this.setOpenMigrationAlert("Please enter a valid amount");
    } else {
      this.setState({ loading: true });
      get_utxos(this.state.address)
        .then(utxos => {
          const rawtx = generateSafexBtcTransaction(
            utxos,
            BURN_ADDRESS,
            this.state.wif,
            amount,
            this.props.data.fee
          );
          return rawtx;
        })
        .then(rawtx => broadcastTransaction(rawtx))
        .then(() => {
          this.setState({
            loading: false,
            migration_complete: true
          });
          this.props.refresh();
          this.toggleConfirmMigration();
        })
        .catch(err => {
          console.log("error broadcasting transaction " + err);
          this.setOpenMigrationAlert("error broadcasting transaction " + err);
        });
    }
  }

  validateAmount(e) {
    if (parseInt(e.target.value) > this.state.safex_bal) {
      console.log(
        "Not enough safex balance for that transaction, max is " +
          this.state.safex_bal
      );
      this.setOpenMigrationAlert(
        "Not enough safex balance for that transaction, max is" +
          this.state.safex_bal
      );
      e.target.value = this.state.safex_bal;
    }
  }

  setOpenMigrationAlert(message) {
    openMigrationAlert(this, message);
  }

  setCloseMigrationAlert() {
    closeMigrationAlert(this);
  }

  toggleConfirmMigration(e) {
    e.preventDefault();
    this.setState({
      confirm_migration: !this.state.confirm_migration
    });
  }

  //create safex blockchain key set
  render() {
    return (
      <div className="final-step">
          <div>
            <p>Final Step</p>
            <p>
              <span>You will need</span> {this.state.txn_fee} btc{" "}
            </p>

            <form
              className="final-step-form"
              onSubmit={this.toggleConfirmMigration}
            >
              <input
                onChange={this.validateAmount}
                name="amount"
                placeholder="Amount"
                id="amount"
              />
              <button className="button-shine">send</button>
            </form>

            <p>
              <span className="span-200">Your target migration address:</span>
              <br />
              <input
                className="target-address"
                value={this.state.safex_key.public_addr}
              />
            </p>
            <p>
              <span className="span-200">The burn address:</span>
              <br />
              <input className="target-address" value={BURN_ADDRESS} />
            </p>

            <MigrationAlert
              migrationAlert={this.state.migration_alert}
              migrationAlertText={this.state.migration_alert_text}
              closeMigrationAlert={this.setCloseMigrationAlert}
            />

            <ConfirmMigration
              confirmMigraton={this.state.confirm_migration}
              burnSafex={this.burnSafex}
              closeConfirmMigration={this.toggleConfirmMigration}
            />
          </div>
      </div>
    );
  }
}
