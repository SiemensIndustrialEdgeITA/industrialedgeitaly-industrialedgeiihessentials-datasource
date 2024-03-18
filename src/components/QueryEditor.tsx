import _ from "lodash";
import defaults from 'lodash/defaults';
import React, { ChangeEvent, MouseEvent } from 'react';
import {
  InlineField,
  Input,
  Select,
  InlineLabel,
  IconButton,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import {
  DEFAULT_QUERY,
  MyDataSourceOptions,
  MyQuery,
  orderOptions,
  aggregateModeOptions,
  aggregateModeOptionsCalculate,
  aggregateTimeOptions,
  whereComparatorOptions,
  whereOperatorOptions,
  whereComparatorType,
  whereOperatorType,
  MyQueryWhereItem
} from '../types';


type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;


export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {

  const onFromChange = (event: ChangeEvent<HTMLInputElement>) => {
    // update the query with new value
    query = { ...query, from: event.target.value };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onToChange = (event: ChangeEvent<HTMLInputElement>) => {
    // update the query with new value
    query = { ...query, to: event.target.value };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onNamesChange = (item: SelectableValue<string>, index: number) => {
    // get the new value or default None mode
    let newValue = item.value !== undefined ? item.value : '';
    // clone the query list and update the value at changed index
    let newVariablesNamesList = _.cloneDeep(query.variablesNamesList);
    newVariablesNamesList[index] = newValue;
    query = { ...query, variablesNamesList: newVariablesNamesList };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
    //}
  };

  const onAggregateModesChange = (item: SelectableValue<string>, index: number) => {
    // get the new value or default None mode
    let newValue = item.value !== undefined ? item.value : 'None';
    // clone the query list and update the value at changed index
    let newAggregateModesList = _.cloneDeep(query.aggregateModesList);
    newAggregateModesList[index] = newValue;
    // update the query with new value
    query = { ...query, aggregateModesList: newAggregateModesList };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onAliasesChange = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    // get the new value or empty string
    let newValue = event.target.value !== undefined ? event.target.value : '';
    // clone the query list and update the value at changed index
    let newAliasesList = _.cloneDeep(query.aliasesList);
    newAliasesList[index] = newValue;
    // update the query with new value
    query = { ...query, aliasesList: newAliasesList };
    // call onChange with new query
    onChange({ ...query });
  };

  const onAliasesBlur = (event: ChangeEvent<HTMLInputElement>) => {
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onWhereElement1Change = (item: SelectableValue<string>, index: number) => {
    // get the new value or empty string
    let newValue = item.value !== undefined ? item.value : '';
    // clone the query where obj and update the value at changed index
    let newWhere = _.cloneDeep(query.where);
    newWhere.items[index].element1 = newValue;
    // update the query with new value
    query = { ...query, where: newWhere };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onWhereComparatorChange = (item: SelectableValue<whereComparatorType>, index: number) => {
    // get the new value or empty string
    let newValue: whereComparatorType = item.value !== undefined ? item.value : '=';
    // clone the query where obj and update the value at changed index
    let newWhere = _.cloneDeep(query.where);
    newWhere.items[index].comparator = newValue;
    // update the query with new value
    query = { ...query, where: newWhere };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onWhereElement2Change = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    // get the new value or empty string
    let newValue = event.target.value !== undefined ? event.target.value : '';
    // clone the query where obj and update the value at changed index
    let newWhere = _.cloneDeep(query.where);
    newWhere.items[index].element2 = newValue;
    // update the query with new value
    query = { ...query, where: newWhere };
    // call onChange with new query
    onChange({ ...query });
  };

  const onWhereOperatorChange = (item: SelectableValue<whereOperatorType>, index: number) => {
    // get the new value or empty string
    let newValue: whereOperatorType = item.value !== undefined ? item.value : '';
    // clone the query where obj and update the value at changed index
    let newWhere = _.cloneDeep(query.where);
    newWhere.operators[index] = newValue;
    // update the query with new value
    query = { ...query, where: newWhere };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onWhereElement2Blur = (event: ChangeEvent<HTMLInputElement>) => {
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onOrderChange = (item: SelectableValue<string>) => {
    // get the new value or default ascending mode
    let newValue = item.value !== undefined ? item.value : 'Ascending';
    // update the query with new value
    query = { ...query, order: newValue };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onAggregateTimeChange = (item: SelectableValue<string>) => {
    // get the new value or default None mode
    let newValue = item.value !== undefined ? item.value : 'None';
    // update the query with new value
    query = { ...query, aggregateTime: newValue };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onNamesOpenMenu = (index: number) => {
    // get the list of available variables from the datasource
    datasource.createVariablesOptions().then((options) => {
      //console.log(options);
      // update the query with new value
      query = { ...query, variablesOptions: options };
      // call onChange with new query
      onChange({ ...query });
    });
  };

  const onwhereElement1OpenMenu = (index: number) => {
    // remove duplicates from the list
    let filteredVariablesNamesList = query.variablesNamesList.filter((value, index, self) => {
      return self.indexOf(value) === index;
    });
    // get the list of available variables names from already populated variablesOptions
    let newVariablesNamesList = filteredVariablesNamesList.map((item: string) => {
      return { "label": item, "value": item }
    }) as Array<SelectableValue<string>>;
    // // if index is the first push an empty string
    // if (index === 0) {
    //   newVariablesNamesList.unshift({ "label": "", "value": "" });
    // }
    // update the query with new value
    query = { ...query, variablesNamesListOptions: newVariablesNamesList };
    // call onChange with new query
    onChange({ ...query });
  };

  const onAddVariableClick = (event: MouseEvent<HTMLButtonElement>) => {
    // clone all query lists and add a new empty row
    let newVariablesNamesList = _.cloneDeep(query.variablesNamesList);
    newVariablesNamesList.push("");
    let newAggregateModesList = _.cloneDeep(query.aggregateModesList);
    newAggregateModesList.push("None");
    let newAliasesList = _.cloneDeep(query.aliasesList);
    newAliasesList.push("");
    // update the query with new variable row
    query = {
      ...query,
      variablesNamesList: newVariablesNamesList, aggregateModesList: newAggregateModesList, aliasesList: newAliasesList
    };
    // call onChange with new query
    onChange({ ...query });
  };

  const onDeleteVariableClick = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    // console.log(index);
    // clone all query lists and delete the row at index
    let newVariablesNamesList = _.cloneDeep(query.variablesNamesList);
    newVariablesNamesList.splice(index, 1);
    let newAggregateModesList = _.cloneDeep(query.aggregateModesList);
    newAggregateModesList.splice(index, 1);
    let newAliasesList = _.cloneDeep(query.aliasesList);
    newAliasesList.splice(index, 1);
    // update the query with new variable row
    query = {
      ...query,
      variablesNamesList: newVariablesNamesList, aggregateModesList: newAggregateModesList, aliasesList: newAliasesList
    };
    // call onChange with new query
    onChange({ ...query });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const onAddWhereClick = (event: MouseEvent<HTMLButtonElement>) => {
    // clone query where list and add a new empty row
    let newWhere = _.cloneDeep(query.where);
    newWhere.items.push({ element1: '', comparator: '=', element2: '' });
    // add a new operator to the list
    newWhere.operators.push(newWhere.items.length > 1 ? "and" : "");
    // update the query with new variable row
    query = { ...query, where: newWhere };
    // call onChange with new query
    onChange({ ...query });
  };

  const onDeleteWhereClick = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    // console.log(index);
    // clone query where list and remove row at index
    let newWhere = _.cloneDeep(query.where);
    newWhere.items.splice(index, 1);
    // remove the operator at index
    newWhere.operators.splice(index, 1);
    // call onChange with new query
    onChange({ ...query, where: newWhere });
    // validate the query and run the query if all properties are valid
    validateQuery().then((isValid) => {
      if (isValid) { onRunQuery(); }
    });
  };

  const validateQuery = () => {
    return new Promise((resolve, reject) => {
      // console.log("valquery", query);
      // initialize the validation flag
      let isValid = true;
      // check if all required properties are valid
      if ((query.from || "") === "") {
        isValid = false;
        console.log("from is invalid");
      }
      if ((query.to || "") === "") {
        isValid = false;
        console.log("to is invalid");
      }
      if (query.variablesNamesList.length === 0) {
        isValid = false;
        console.log("variablesNamesList is invalid");
      }
      if (query.variablesNamesList.length !== query.aggregateModesList.length) {
        isValid = false;
        console.log("variablesNamesList and aggregateModesList are not equal length");
      }
      if (query.variablesNamesList.length !== query.aliasesList.length) {
        isValid = false;
        console.log("variablesNamesList and aliasesList are not equal length");
      }
      if (query.variablesNamesList.includes("")) {
        isValid = false;
        console.log("variablesNamesList includes empty strings");
      }
      // query.where.items.forEach((where: MyQueryWhereItem) => {
      //   if (where.element1 === "" && where.element2 !== "") {
      //     isValid = false;
      //     console.log("where is invalid");
      //   }
      //   if (where.element1 !== "" && where.element2 === "") {
      //     isValid = false;
      //     console.log("where is invalid");
      //   }
      // });

      // console.log("is valid", isValid);
      // return the validation result as a promise
      resolve(isValid);
    });
  };


  // get the query properties or default values
  const {
    from,
    to,
    order,
    variablesNamesList,
    variablesOptions,
    aliasesList,
    aggregateModesList,
    aggregateTime,
    where,
    variablesNamesListOptions
  } = defaults(query, DEFAULT_QUERY);



  return (
    <>
      <div className="gf-form">
        <InlineField label="From"
          labelWidth={20}
          tooltip="Start datetime for query."
          invalid={(from || "") === ""}
          error={(from || "") === "" ? 'Please insert a valid query start time.' : ''}>
          <Input
            width={30}
            onChange={onFromChange}
            value={from || ""}
            type="text" />
        </InlineField>
        <InlineField label="To"
          labelWidth={20}
          tooltip="End datetime for query."
          invalid={(to || "") === ""}
          error={(to || "") === "" ? 'Please insert a valid query end time.' : ''}>
          <Input
            width={30}
            onChange={onToChange}
            value={to || "${__from:date}"}
            type="text" />
        </InlineField>
      </div>


      <div className="gf-form">
        <InlineLabel width={50}
          tooltip="Variables Names to be queried from database.">
          Variables
        </InlineLabel>
        <InlineLabel width={20}
          tooltip="Aggregation function applied on data.
        When Aggregate Time is set to None the following 
        aggregation functions are not available: 
        MinMaxTrend, Gantt, GanttView, StepDuration, ValueChanges.">
          Acquisition Mode
        </InlineLabel>
        <InlineLabel width={30}
          tooltip="Aliases to be applied on the Variables Names.">
          Aliases
        </InlineLabel>
      </div>

      <div>
        {aggregateModesList.map((mode: string, index: number) => {
          return (
            <div className="gf-form" key={index}>
              <Select
                width={50}
                menuPlacement="top"
                allowCustomValue={false}
                options={variablesOptions}
                onOpenMenu={() => onNamesOpenMenu(index)}
                value={variablesOptions.find((item) => item.value === variablesNamesList[index])}
                onChange={(v: any) => onNamesChange(v, index)}
              />

              <Select
                width={20}
                menuPlacement="top"
                allowCustomValue={false}
                options={aggregateTime === "None"
                  ? aggregateModeOptionsCalculate
                  : aggregateModeOptions}
                value={aggregateTime === "None"
                  ? aggregateModeOptionsCalculate.find((item) => item.value === mode)
                  : aggregateModeOptions.find((item) => item.value === mode)}
                onChange={(v: any) => onAggregateModesChange(v, index)}
              />

              <Input
                width={30}
                onChange={(v: any) => onAliasesChange(v, index)}
                onBlur={onAliasesBlur}
                value={aliasesList[index]}
                placeholder="Insert an Alias Name for the Variable"
                type="text" />

              <InlineField label="" labelWidth={10} grow={true} style={{ alignItems: 'center', flex: 1 }}>
                {index === 0 && aggregateModesList.length === 1
                  ? (<span></span>)
                  : (<IconButton name="trash-alt" size="xl" variant="destructive" onClick={(v: any) => onDeleteVariableClick(v, index)} />)}
              </InlineField>

            </div>
          )
        })}

      </div>

      <div className="gf-form">
        <InlineField label="" labelWidth={10} grow={true} style={{ alignItems: 'center', flex: 1 }}>
          <IconButton name="plus" size="xl" variant="secondary" onClick={onAddVariableClick} />
        </InlineField>
      </div>

      <div className="gf-form">
        <InlineLabel width={100}
          tooltip="A where clause to be applied on the query.">
          Where
        </InlineLabel>
      </div>

      <div>
        {where.items.map((whereItem: MyQueryWhereItem, index: number) => {
          return (
            <div className="gf-form" key={index}>

              {index > 0
                ? <Select
                  width={10}
                  menuPlacement="top"
                  allowCustomValue={false}
                  options={whereOperatorOptions}
                  value={whereOperatorOptions.find((item) => item.value === where.operators[index])}
                  onChange={(v: any) => onWhereOperatorChange(v, index)}
                />
                : <InlineLabel width={9.5}>&#8203;</InlineLabel>}

              <Select
                width={50}
                menuPlacement="top"
                allowCustomValue={false}
                options={variablesNamesListOptions}
                onOpenMenu={() => onwhereElement1OpenMenu(index)}
                value={variablesNamesList.find((item) => item === whereItem.element1)}
                onChange={(v: any) => onWhereElement1Change(v, index)}
              />

              <Select
                width={17}
                menuPlacement="top"
                allowCustomValue={false}
                options={whereComparatorOptions}
                value={whereComparatorOptions.find((item) => item.value === whereItem.comparator)}
                onChange={(v: any) => onWhereComparatorChange(v, index)}
              />

              <Input
                width={23}
                onChange={(v: any) => onWhereElement2Change(v, index)}
                onBlur={onWhereElement2Blur}
                value={whereItem.element2}
                type="text" />

              <InlineField label="" labelWidth={10} grow={true} style={{ alignItems: 'center', flex: 1 }}>
                <IconButton name="trash-alt" size="xl" variant="destructive" onClick={(v: any) => onDeleteWhereClick(v, index)} />
              </InlineField>
            </div>
          )
        })}
      </div>

      <div className="gf-form">
        <InlineField label="" labelWidth={10} grow={true} style={{ alignItems: 'center', flex: 1 }}>
          <IconButton name="plus" size="xl" variant="secondary" onClick={onAddWhereClick} />
        </InlineField>
      </div>

      <div className="gf-form">
        <InlineField label="Aggregate Time"
          labelWidth={20}
          tooltip="Time groups for data aggregation.
            Using None will return raw values.">
          <Select
            width={20}
            menuPlacement="top"
            allowCustomValue={false}
            options={aggregateTimeOptions}
            value={aggregateTimeOptions.find((item) => item.value === aggregateTime)}
            onChange={onAggregateTimeChange}
          />
        </InlineField>

        <InlineField label="Order"
          labelWidth={20}
          onLoad={onRunQuery}
          tooltip="Data ordering could be Ascending or Descending.">
          <Select
            width={20}
            menuPlacement="bottom"
            allowCustomValue={false}
            options={orderOptions}
            value={orderOptions.find((item) => item.value === order)}
            onChange={onOrderChange}
          />
        </InlineField>
      </div>

    </>
  );
}
