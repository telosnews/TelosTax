import { ColumnMapping } from '../../services/csvParser';

interface ColumnMappingEditorProps {
  headers: string[];
  mapping: ColumnMapping;
  targetType: '1099b' | '1099da';
  onChange: (mapping: ColumnMapping) => void;
}

interface MappingField {
  key: keyof ColumnMapping;
  label: string;
  required?: boolean;
  onlyFor?: '1099b' | '1099da';
}

const MAPPING_FIELDS: MappingField[] = [
  { key: 'proceeds', label: 'Proceeds / Sale Price', required: true },
  { key: 'costBasis', label: 'Cost Basis', required: true },
  { key: 'dateSold', label: 'Date Sold' },
  { key: 'dateAcquired', label: 'Date Acquired' },
  { key: 'description', label: 'Description / Symbol' },
  { key: 'holdingPeriod', label: 'Holding Period (Long/Short)' },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld' },
  { key: 'washSaleLoss', label: 'Wash Sale Loss Disallowed' },
  { key: 'tokenName', label: 'Token / Asset Name', onlyFor: '1099da' },
  { key: 'tokenSymbol', label: 'Token Symbol', onlyFor: '1099da' },
  { key: 'transactionId', label: 'Transaction ID / Hash', onlyFor: '1099da' },
];

export default function ColumnMappingEditor({
  headers,
  mapping,
  targetType,
  onChange,
}: ColumnMappingEditorProps) {
  const visibleFields = MAPPING_FIELDS.filter(
    f => !f.onlyFor || f.onlyFor === targetType,
  );

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    onChange({
      ...mapping,
      [field]: value || undefined,
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-3">
        Map your CSV columns to the fields below. Required fields are marked with *.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {visibleFields.map((field) => (
          <div key={field.key} className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-40 shrink-0">
              {field.label}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <select
              value={mapping[field.key] || ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="input-field text-xs py-1.5 flex-1"
            >
              <option value="">— Not mapped —</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
