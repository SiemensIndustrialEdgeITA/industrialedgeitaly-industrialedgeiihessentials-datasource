import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms, Select, MultiSelect, InlineField, InlineSwitch, Input } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import {
  defaultQuery,
  MyDataSourceOptions,
  MyQuery,
  orderOptions,
  aggregateModeOptions,
  aggregateTimeOptions,
} from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onFromChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, from: event.target.value });
    onRunQuery();
  };

  onToChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, to: event.target.value });
    onRunQuery();
  };

  onRawModeChange = (event: ChangeEvent<HTMLInputElement>) => {
    //console.log(event.target.value, event.target.checked);
    const { onChange, query } = this.props;
    onChange({ ...query, variablesRawMode: Boolean(event.target.checked) });
  };

  onNamesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, variablesNames: event.target.value });
    onRunQuery();
  };

  onMultiNamesChange = (items: Array<SelectableValue<string>>) => {
    let newVariables = items.map((item) => item.value).join();
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, variablesNames: newVariables });
    onRunQuery();
  };

  onAliasesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, aliases: event.target.value });
    onRunQuery();
  };

  onOrderChange = (item: SelectableValue<string>) => {
    let newValue = item.value !== undefined ? item.value : 'Ascending';
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, order: newValue });
    onRunQuery();
  };

  onAggregateModeChange = (item: SelectableValue<string>) => {
    let newValue = item.value !== undefined ? item.value : 'None';
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, aggregateMode: newValue });
    onRunQuery();
  };

  onAggregateTimeChange = (item: SelectableValue<string>) => {
    let newValue = item.value !== undefined ? item.value : 'None';
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, aggregateTime: newValue });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const {
      from,
      to,
      order,
      variablesNames,
      variablesOptions,
      variablesRawMode,
      aliases,
      aggregateMode,
      aggregateTime,
    } = query;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              width={10}
              labelWidth={10}
              value={from || ''}
              onChange={this.onFromChange}
              label="From"
              tooltip="Start datetime for query."
            />
          </div>
          <div className="gf-form">
            <FormField
              width={10}
              labelWidth={10}
              value={to || '${__from:date}'}
              onChange={this.onToChange}
              label="To"
              tooltip="End datetime for query."
            />
          </div>
        </div>

        <div className="gf-form-inline">
          <InlineField labelWidth={20} label="Variables" tooltip="For Variables Names property.">
            <InlineSwitch label="Text Mode" showLabel={true} value={variablesRawMode} onChange={this.onRawModeChange} />
          </InlineField>

          <div className="gf-form">
            {variablesRawMode ? (
              <Input width={50} value={variablesNames || ''} onChange={this.onNamesChange} />
            ) : (
              <MultiSelect
                width={50}
                menuPlacement="bottom"
                allowCustomValue={false}
                options={variablesOptions}
                onOpenMenu={() => {
                  this.props.datasource.createVariablesOptions().then((options) => {
                    this.props.onChange({ ...query, variablesOptions: options });
                  });
                }}
                value={variablesOptions.filter((item) =>
                  typeof item.value === 'string' ? variablesNames.includes(item.value) : false
                )}
                onChange={(v) => this.onMultiNamesChange(v)}
              />
            )}
          </div>
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              width={50}
              labelWidth={10}
              value={aliases || ''}
              onChange={this.onAliasesChange}
              label="Aliases"
              tooltip="List of aliases to be applied on the results Variables Names."
            />
          </div>
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField labelWidth={20} label="Order" tooltip="Ascending or Descending.">
              <Select
                width={16}
                menuPlacement="bottom"
                allowCustomValue={false}
                options={orderOptions}
                value={orderOptions.find((item) => item.value === order)}
                onChange={this.onOrderChange}
              />
            </InlineField>
          </div>
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField labelWidth={20} label="Aggregate Mode" tooltip="Aggregate function to be applied on data.">
              <Select
                width={16}
                menuPlacement="bottom"
                allowCustomValue={false}
                options={aggregateModeOptions}
                value={aggregateModeOptions.find((item) => item.value === aggregateMode)}
                onChange={this.onAggregateModeChange}
              />
            </InlineField>
            <InlineField
              labelWidth={20}
              label="Aggregate Time"
              tooltip="Time range for data groups aggregation. None will use the whole time range."
            >
              <Select
                width={16}
                menuPlacement="bottom"
                allowCustomValue={false}
                options={aggregateTimeOptions}
                value={aggregateTimeOptions.find((item) => item.value === aggregateTime)}
                onChange={this.onAggregateTimeChange}
              />
            </InlineField>
          </div>
        </div>
      </>
    );
  }
}
