import _ from "lodash";
import defaults from 'lodash/defaults';
import React, { useState } from 'react';
import {
  MyVariableQuery,
  aggregateModeOptionsCalculate,
  aggregateTimeOptions,
  DEFAULT_QUERY_VARIABLE,
} from '../types';
import { DataSource } from 'datasource';

interface VariableQueryProps {
  query: MyVariableQuery;
  datasource: DataSource;
  onChange: (query: MyVariableQuery) => void;
}

export const VariableQueryEditor = ({ onChange, query, datasource }: VariableQueryProps) => {

  const onNamesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    //console.log(event.currentTarget.value);
    // get the new value or empty string
    let newValue = event.currentTarget.value !== undefined ? event.currentTarget.value : '';
    // clone the query list and update the value at changed index
    let newVariablesNamesList = _.cloneDeep(state.variablesNamesList);
    newVariablesNamesList[0] = newValue;
    // update the query with new variable row
    state = {
      ...state,
      variablesNamesList: newVariablesNamesList
    };
    // call onChange with new query
    setState({ ...state });
    saveQuery();
  };

  const onAggregateModesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    //console.log(event.currentTarget.value);
    // get the new value or empty string
    let newValue = event.currentTarget.value !== undefined ? event.currentTarget.value : 'None';
    // clone the query list and update the value at changed index
    let newAggregateModesList = _.cloneDeep(state.aggregateModesList);
    newAggregateModesList[0] = newValue;
    // update the query with new variable row
    state = {
      ...state,
      aggregateModesList: newAggregateModesList
    };
    // call onChange with new query
    setState({ ...state });
    saveQuery();
  };

  // const onAliasesChange = (event: React.FormEvent<HTMLInputElement>) => {
  //   //console.log(event.currentTarget.value);
  //   // get the new value or empty string
  //   let newValue = event.currentTarget.value !== undefined ? event.currentTarget.value : '';
  //   // clone the query list and update the value at changed index
  //   let newAliasesList = _.cloneDeep(state.aliasesList);
  //   newAliasesList[0] = newValue;
  //   // update the query with new variable row
  //   state = {
  //     ...state,
  //     aliasesList: newAliasesList
  //   };
  //   // call onChange with new query
  //   setState({ ...state });
  //   saveQuery();
  // };

  const onAggregateTimeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    //console.log(event.currentTarget.value);
    // get the new value or empty string
    let newValue = event.currentTarget.value !== undefined ? event.currentTarget.value : 'None';
    // update the query with new variable row
    state = {
      ...state,
      aggregateTime: newValue
    };
    // call onChange with new query
    setState({ ...state });
    saveQuery();
  };

  const onDatesChange = (event: React.FormEvent<HTMLInputElement>) => {
    // update the query with new variable row
    state = {
      ...state,
      [event.currentTarget.name]: event.currentTarget.value,
    };
    setState({ ...state });
    saveQuery();
  };

  const onNamesFocus = () => {
    // get the list of available variables from the datasource
    datasource.createVariablesOptions().then((options) => {
      //console.log(options);
      // remove grafana variables from the list
      options = options.filter((item: any) => {
        return item.label !== "Grafana Variables";
      });
      // call onChange with new query
      setState({ ...state, variablesOptions: options });
    });
  };

  const validateQuery = () => {
    return new Promise((resolve, reject) => {
      // initialize the validation flag
      let isValid = true;
      // check if all required properties are valid
      if ((state.from || "") === "") {
        isValid = false;
        console.log("from is invalid");
      }
      if ((state.to || "") === "") {
        isValid = false;
        console.log("to is invalid");
      }
      if (state.variablesNamesList.length === 0) {
        isValid = false;
        console.log("variablesNamesList is invalid");
      }
      if (state.variablesNamesList.length !== state.aggregateModesList.length) {
        isValid = false;
        console.log("variablesNamesList and aggregateModesList are not equal length");
      }
      // if (state.variablesNamesList.length !== state.aliasesList.length) {
      //   isValid = false;
      //   console.log("variablesNamesList and aliasesList are not equal length");
      // }
      if (state.variablesNamesList.includes("")) {
        isValid = false;
        console.log("variablesNamesList includes empty strings");
      }

      // console.log("is valid", isValid);
      // return the validation result as a promise
      resolve(isValid);
    });
  };

  const saveQuery = () => {
    // onChange(state);
    validateQuery().then((isValid) => {
      if (isValid) { onChange(state); }
    });
  };


  let [state, setState] = useState(defaults(query, DEFAULT_QUERY_VARIABLE));


  return (
    <>
      <div className="gf-form">
        <span className="gf-form-label width-10">From</span>
        <input
          name="from"
          className="gf-form-input width-20"
          onChange={onDatesChange}
          value={state.from || "${__from:date}"}
        />
      </div>

      <div className="gf-form">
      <span className="gf-form-label width-10">To</span>
        <input
          name="to"
          className="gf-form-input width-20"
          onChange={onDatesChange}
          value={state.to || "${__to:date}"}
        />
      </div>

      {/* <div className="gf-form">
        <span className="gf-form-label width-30">Variable</span>
        <span className="gf-form-label width-10">Acquisition Mode</span>
        <span className="gf-form-label width-20">Alias</span>
      </div> */}

      <div className="gf-form">
        <span className="gf-form-label width-10">Variable</span>
        <select
          className='gf-form-select-wrapper width-30'
          onChange={onNamesChange}
          onFocus={onNamesFocus}
          value={state.variablesOptions.find((o: any) => o.value === state.variablesNamesList[0])?.value || ""}
        >
          {state.variablesOptions.map((item, index) => {
            return (
              <option key={index} value={item.value}>{item.label}</option>
            )
          })}
        </select>
      </div>

      <div className="gf-form">
        <span className="gf-form-label width-10">Acquisition Mode</span>
        <select
          className='gf-form-select-wrapper width-20'
          onChange={onAggregateModesChange}
          value={aggregateModeOptionsCalculate.find((o: any) => o.value === state.aggregateModesList[0])?.value || ""}
        >
          {aggregateModeOptionsCalculate.map((item, index) => {
            return (
              <option key={index} value={item.value}>{item.label}</option>
            )
          })}
        </select>
        {/* <input
          width={30}
          name="Alias"
          className="gf-form-input width-20"
          onChange={onAliasesChange}
          value={state.aliasesList[0] || ""}
        /> */}
      </div>

      <div className="gf-form">
        <span className="gf-form-label width-10">Aggregate Time</span>
        <select
          className='gf-form-select-wrapper width-20'
          onChange={onAggregateTimeChange}
          value={aggregateTimeOptions.find((o: any) => o.value === state.aggregateTime)?.value || ""}
        >
          {aggregateTimeOptions.map((item, index) => {
            return (
              <option key={index} value={item.value}>{item.label}</option>
            )
          })}
        </select>
      </div>

    </>
  );
};
