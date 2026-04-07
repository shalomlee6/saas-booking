import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ── Status Enum ────────────────────────────────────────────────────────────────
export enum FieldStatus {
  OptionalFix = 1,
  Error = 2,
  Warning = 3,
  Valid = 4,
}

export const STATUS_CONFIG: Record<FieldStatus, { label: string; cssClass: string }> = {
  [FieldStatus.Valid]:       { label: 'תקין',             cssClass: 'status-valid'    },
  [FieldStatus.OptionalFix]: { label: 'תיקון אופציונלי', cssClass: 'status-optional' },
  [FieldStatus.Error]:       { label: 'שגיאה',            cssClass: 'status-error'    },
  [FieldStatus.Warning]:     { label: 'אזהרה',            cssClass: 'status-warning'  },
};

// ── Interfaces ─────────────────────────────────────────────────────────────────
export interface FraudCheckField {
  code: number;
  title: string;
  message: string;
  policyValue: string | null;
  isoValue: string | null;
  status: FieldStatus;
  selectedValue: string | null;
  additionalInfoList: string[] | null;
}

export interface FraudCheckSection {
  title: string;
  result: FraudCheckField[];
}

export interface FraudCheckData {
  vehicleSection: FraudCheckSection;
  driverSection: FraudCheckSection;
  sendConfig: {
    phoneNumber: string;
    sendMethod: 'SMS' | 'LINE';
    connectionSuccess: boolean;
  };
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_DATA: FraudCheckData = {
  vehicleSection: {
    title: 'הרכב',
    result: [
      { code: 1,  title: 'מספר רישוי', message: '', policyValue: '53624163',   isoValue: null, status: FieldStatus.Valid, selectedValue: '53624163',   additionalInfoList: null },
      { code: 2,  title: 'סוג רכב',    message: '', policyValue: 'פרטי M1',    isoValue: null, status: FieldStatus.Valid, selectedValue: 'פרטי M1',    additionalInfoList: null },
      { code: 3,  title: 'שנת יצור',   message: '', policyValue: '2017',        isoValue: null, status: FieldStatus.Valid, selectedValue: '2017',        additionalInfoList: null },
      { code: 4,  title: 'נפח מנוע',   message: '', policyValue: '1373',        isoValue: null, status: FieldStatus.Valid, selectedValue: '1.73',        additionalInfoList: null },
      { code: 5,  title: 'משקל',       message: '', policyValue: '1.73',        isoValue: null, status: FieldStatus.Valid, selectedValue: '1.73',        additionalInfoList: null },
      { code: 6,  title: 'LDW',        message: '', policyValue: 'יש',          isoValue: null, status: FieldStatus.Valid, selectedValue: 'יש',          additionalInfoList: null },
    ],
  },
  driverSection: {
    title: 'הנהג',
    result: [
      { code: 24, title: 'ת.ז',        message: '', policyValue: '53624163',   isoValue: null, status: FieldStatus.Valid,       selectedValue: '53624163',   additionalInfoList: null },
      { code: 21, title: 'שם פרטי',    message: '', policyValue: 'יוסי',       isoValue: null, status: FieldStatus.OptionalFix, selectedValue: 'איתי',       additionalInfoList: null },
      { code: 22, title: 'שם משפחה',   message: '', policyValue: 'דניגל',      isoValue: null, status: FieldStatus.OptionalFix, selectedValue: 'לזוון',      additionalInfoList: null },
      { code: 23, title: 'מין',        message: '', policyValue: 'זכר',        isoValue: null, status: FieldStatus.Valid,       selectedValue: 'זכר',        additionalInfoList: null },
      { code: 25, title: 'תאריך לידה', message: '', policyValue: '07/06/2007', isoValue: null, status: FieldStatus.Valid,       selectedValue: '07/06/2007', additionalInfoList: null },
      { code: 26, title: 'תביעות',     message: '', policyValue: '0',          isoValue: null, status: FieldStatus.Valid,       selectedValue: '0',          additionalInfoList: null },
    ],
  },
  sendConfig: {
    phoneNumber: '052-3468514',
    sendMethod: 'SMS',
    connectionSuccess: true,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-fraud-database',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fraud-database.component.html',
  styleUrls: ['./fraud-database.component.scss'],
})
export class FraudDatabaseComponent implements OnInit {
  readonly FieldStatus = FieldStatus;
  readonly STATUS_CONFIG = STATUS_CONFIG;

  data = signal<FraudCheckData>(MOCK_DATA);
  vehicleExpanded = signal(true);
  driverExpanded = signal(true);
  sendMethod = signal<'SMS' | 'LINE'>('SMS');
  phoneNumber = signal('052-3468514');
  connectionSuccess = signal(true);
  sendLinkToForms = signal(true);

  ngOnInit(): void {
    // TODO: replace with service call → this.fraudService.getData().subscribe(d => this.data.set(d));
    const cfg = this.data().sendConfig;
    this.sendMethod.set(cfg.sendMethod);
    this.phoneNumber.set(cfg.phoneNumber);
    this.connectionSuccess.set(cfg.connectionSuccess);
  }

  getIsoDisplay(field: FraudCheckField): string {
    if (field.isoValue) return field.isoValue;
    return field.status === FieldStatus.Valid
      ? (field.policyValue ?? '—')
      : (field.selectedValue ?? '—');
  }

  trackByCode(_: number, f: FraudCheckField): number {
    return f.code;
  }

  onSend(): void {
    console.log('Send via', this.sendMethod(), 'to', this.phoneNumber());
  }
}
