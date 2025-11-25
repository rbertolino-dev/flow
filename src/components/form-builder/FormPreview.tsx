import { useState } from "react";
import { FormField, FormStyle } from "@/types/formBuilder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FormPreviewProps {
  fields: FormField[];
  style: FormStyle;
  onSubmit?: (data: Record<string, any>) => void;
}

export function FormPreview({ fields, style, onSubmit }: FormPreviewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const updateField = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const renderField = (field: FormField) => {
    const baseStyle = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      borderRadius: style.borderRadius,
      borderColor: style.inputBorderColor,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: style.textColor }}>
              {field.label} {field.required && <span style={{ color: style.primaryColor }}>*</span>}
            </Label>
            <Input
              type={field.type}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.name] || ''}
              onChange={(e) => updateField(field.name, e.target.value)}
              style={baseStyle}
              className="focus:ring-2"
              onFocus={(e) => {
                e.target.style.borderColor = style.inputFocusColor;
                e.target.style.outline = `2px solid ${style.inputFocusColor}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = style.inputBorderColor;
                e.target.style.outline = 'none';
              }}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: style.textColor }}>
              {field.label} {field.required && <span style={{ color: style.primaryColor }}>*</span>}
            </Label>
            <Textarea
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              value={formData[field.name] || ''}
              onChange={(e) => updateField(field.name, e.target.value)}
              style={baseStyle}
              className="focus:ring-2"
              onFocus={(e) => {
                e.target.style.borderColor = style.inputFocusColor;
                e.target.style.outline = `2px solid ${style.inputFocusColor}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = style.inputBorderColor;
                e.target.style.outline = 'none';
              }}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: style.textColor }}>
              {field.label} {field.required && <span style={{ color: style.primaryColor }}>*</span>}
            </Label>
            <Select
              value={formData[field.name] || ''}
              onValueChange={(value) => updateField(field.name, value)}
              required={field.required}
            >
              <SelectTrigger style={baseStyle}>
                <SelectValue placeholder={field.placeholder || 'Selecione...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option, idx) => (
                  <SelectItem key={idx} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={formData[field.name] || false}
              onCheckedChange={(checked) => updateField(field.name, checked)}
              required={field.required}
            />
            <Label htmlFor={field.id} style={{ color: style.textColor }}>
              {field.label} {field.required && <span style={{ color: style.primaryColor }}>*</span>}
            </Label>
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <Label style={{ color: style.textColor }}>
              {field.label} {field.required && <span style={{ color: style.primaryColor }}>*</span>}
            </Label>
            <RadioGroup
              value={formData[field.name] || ''}
              onValueChange={(value) => updateField(field.name, value)}
              required={field.required}
            >
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${idx}`} />
                  <Label htmlFor={`${field.id}-${idx}`} style={{ color: style.textColor }}>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      default:
        return null;
    }
  };

  const buttonStyle = {
    backgroundColor: style.buttonStyle === 'filled' ? style.buttonColor : 'transparent',
    color: style.buttonStyle === 'filled' ? style.buttonTextColor : style.buttonColor,
    border: style.buttonStyle === 'outlined' ? `2px solid ${style.buttonColor}` : 'none',
    borderRadius: style.borderRadius,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    padding: '12px 24px',
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: style.backgroundColor,
        color: style.textColor,
        fontFamily: style.fontFamily,
        padding: '24px',
        borderRadius: style.borderRadius,
      }}
      className="space-y-4"
    >
      {fields.sort((a, b) => a.order - b.order).map(renderField)}
      
      <Button
        type="submit"
        style={buttonStyle}
        className="w-full"
      >
        Enviar
      </Button>
    </form>
  );
}

