import { describe, expect, it } from 'vitest';
import type { DetectedFormat } from '../src/index.js';
import { parsePnr } from '../src/index.js';
import { loadFixtures, paxSig, segSig } from './helpers.js';

/**
 * Hand-written expectations for every synthetic fixture.
 * - `unparsed`: `line:category` for each line kept in `unparsedLines`
 * - `warnings`: `CODE@line` (or `CODE@-` for warnings not tied to a line)
 */
interface Expectation {
  format: DetectedFormat;
  locator?: string;
  pax?: string[];
  segs: string[];
  unparsed?: string[];
  warnings?: string[];
}

const EXPECTED: Record<string, Expectation> = {
  // ---------------------------------------------------------------- Amadeus
  'amadeus/01-oneway-single.txt': {
    format: 'amadeus',
    locator: 'ZQ7TKD',
    pax: ['1 SAMPLE/JOHN MR ADT'],
    segs: ['2 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1 rl=YT4KQ9'],
    unparsed: ['1:header', '4:contact', '5:ticketing'],
  },
  'amadeus/02-return-family-infant-child.txt': {
    format: 'amadeus',
    locator: 'R8WLPM',
    pax: [
      '1 DOE/JAMES MR ADT',
      '1.INF DOE/LILY - INF dob=2026-05-02',
      '2 DOE/MARY MRS ADT',
      '3 DOE/ADAM MSTR CHD dob=2018-01-05',
    ],
    segs: [
      '4 EK18 Y 2026-11-20 MANDXB 14:15-00:30+1 HK3 rl=7QWXZP',
      '5 EK17 Y 2026-12-04 DXBMAN 07:45-11:50+0 HK3 rl=7QWXZP',
    ],
    unparsed: ['1:header', '6:contact', '7:contact', '8:ticketing', '9:ssr', '10:ssr'],
  },
  'amadeus/03-multi-city.txt': {
    format: 'amadeus',
    locator: 'K2HNVC',
    pax: ['1 EXAMPLE/SOPHIE MS ADT'],
    segs: [
      '2 EK2 Y 2026-11-05 LHRDXB 14:40-00:40+1 HK1 rl=PL3RTA',
      '3 EK412 Y 2026-11-06 DXBSYD 02:15-22:15+0 HK1 rl=PL3RTA',
      '4 SQ222 Y 2026-11-20 SYDSIN 15:40-21:15+0 HK1 rl=V9KMDE',
      '5 SQ322 Y 2026-11-22 SINLHR 23:35-06:15+1 HK1 rl=V9KMDE',
    ],
    unparsed: ['1:header', '7:contact'],
  },
  'amadeus/04-day-offsets-minus1-plus2.txt': {
    format: 'amadeus',
    locator: 'B6NQRS',
    pax: ['1 ROE/RICHARD MR ADT'],
    segs: [
      '2 HA452 Y 2026-12-16 SYDHNL 01:00-14:00-1 HK1 rl=MZ8QWE',
      '3 SQ26 J 2026-12-19 JFKSIN 21:40-07:40+2 HK1 rl=N3VBXC',
    ],
    unparsed: ['1:header'],
  },
  'amadeus/05-codeshare.txt': {
    format: 'amadeus',
    locator: 'T4CPLX',
    pax: ['1 PLACEHOLDER/ANNA MRS ADT', '2 PLACEHOLDER/PETER MR ADT'],
    segs: [
      '3 BA1511 Y 2026-11-12 LHRJFK 09:05-12:10+0 HK2 op=AMERICAN AIRLINES rl=HW2QAZ',
      '4 AA104 Y 2026-11-19 JFKLHR 18:30-06:35+1 HK2 rl=JX7TRE',
      '5 BA4612 Y 2026-11-21 LHRMAD 07:15-10:40+0 HK2 op=IBERIA rl=HW2QAZ',
    ],
    unparsed: ['1:header'],
  },
  'amadeus/06-waitlist.txt': {
    format: 'amadeus',
    locator: 'W5LKJH',
    pax: ['1 FICTIVE/OMAR MR ADT', '2 FICTIVE/HUDA MRS ADT'],
    segs: [
      '3 EK600 Y 2026-12-18 DXBKHI 21:55-01:45+1 HL2',
      '4 EK602 Y 2026-12-18 DXBKHI 10:15-14:10+0 HK2 rl=R2D2QQ',
      '5 EK609 Y 2027-01-02 KHIDXB 04:15-05:40+0 KL2 rl=R2D2QQ',
    ],
    unparsed: ['1:header'],
  },
  'amadeus/07-cancelled-schedule-change.txt': {
    format: 'amadeus',
    locator: 'H8MNBV',
    pax: ['1 NOBODY/ALEX MR ADT'],
    segs: [
      '2 TK1980 Y 2026-11-03 LHRIST 11:35-17:35+0 UN1',
      '3 TK1986 Y 2026-11-03 LHRIST 13:40-19:45+0 TK1 rl=QA5SDF',
      '4 TK94 Y 2026-11-03 ISTJED 20:50-00:35+1 HX1',
      '5 TK96 Y 2026-11-04 ISTJED 01:55-05:40+0 TK1 rl=QA5SDF',
    ],
    unparsed: ['1:header'],
  },
  'amadeus/08-umrah-man-jed-med.txt': {
    format: 'amadeus',
    locator: 'U7MRHJ',
    pax: [
      '1 TESTCASE/IMRAN MR ADT',
      '1.INF TESTCASE/HAMZA - INF dob=2026-02-15',
      '2 TESTCASE/AISHA MRS ADT',
      '3 TESTCASE/YUSUF MSTR CHD dob=2017-03-11',
      '4 TESTCASE/MARYAM MISS CHD dob=2019-06-30',
    ],
    segs: [
      '5 SV122 Y 2026-12-22 MANJED 22:35-07:10+1 HK4 rl=KQ4XRT',
      '6 SV123 Y 2027-01-06 MEDMAN 01:05-05:35+0 HK4 rl=KQ4XRT',
    ],
    unparsed: ['1:header', '6:ssr', '7:ssr', '8:ssr', '9:remark', '10:ticketing'],
  },
  'amadeus/09-umrah-lhr-doh-jed.txt': {
    format: 'amadeus',
    locator: 'Q3DJMA',
    pax: ['1 MOCK/BILAL MR ADT', '2 MOCK/SANA MRS ADT'],
    segs: [
      '3 QR4 Y 2027-02-10 LHRDOH 08:45-18:30+0 HK2 rl=7HJKLM',
      '4 QR1186 Y 2027-02-10 DOHJED 21:35-23:45+0 HK2 rl=7HJKLM',
      '5 QR1185 Y 2027-02-24 MEDDOH 02:00-04:00+0 HK2 rl=7HJKLM',
      '6 QR3 Y 2027-02-24 DOHLHR 07:30-12:15+0 HK2 rl=7HJKLM',
    ],
    unparsed: ['1:header'],
  },
  'amadeus/10-lowercase-extra-spaces.txt': {
    format: 'amadeus',
    locator: 'M4NPQZ',
    pax: ['1 DUMMY/SARAH MS ADT', '2 DUMMY/TOM MR ADT'],
    segs: [
      '3 BA287 Y 2026-11-09 LHRSFO 11:35-14:50+0 HK2 rl=ZX9WVU',
      '4 BA286 Y 2026-11-16 SFOLHR 20:10-14:25+1 HK2 rl=ZX9WVU',
    ],
    unparsed: ['1:header'],
  },
  'amadeus/11-wrapped-lines.txt': {
    format: 'amadeus',
    locator: 'J9WRAP',
    pax: ['1 EXAMPLE/LIAM MR ADT'],
    segs: [
      '2 VS3 Y 2026-12-03 LHRJFK 08:30-11:40+0 HK1 rl=ABQ2RT',
      '3 VS4 Y 2026-12-10 JFKLHR 18:30-06:30+1 HK1 rl=ABQ2RT',
    ],
    unparsed: ['1:header'],
    warnings: ['WRAPPED_LINE_JOINED@3', 'WRAPPED_LINE_JOINED@5'],
  },
  'amadeus/12-garbage-and-elements.txt': {
    format: 'amadeus',
    locator: 'G4RBGE',
    pax: ['1 BLOGGS/FRED MR ADT'],
    segs: [
      '2 LH901 Y 2026-11-14 LHRFRA 07:20-09:55+0 HK1 rl=Y8UIOP',
      '3 LH630 Y 2026-11-14 FRAJED 13:50-19:45+0 HK1 rl=Y8UIOP',
    ],
    unparsed: [
      '1:header',
      '5:contact',
      '6:ssr',
      '7:osi',
      '8:remark',
      '9:unknown',
      '10:unknown',
      '11:fare',
      '12:fare',
    ],
  },
  'amadeus/13-no-header.txt': {
    format: 'amadeus',
    pax: ['1 SAMPLE/NADIA MS ADT'],
    segs: [
      '2 PK785 Y 2026-12-05 ISBLHR 09:00-13:30+0 HK1 rl=T6YHNM',
      '3 PK786 Y 2026-12-12 LHRISB 15:30-06:10+1 HK1 rl=T6YHNM',
    ],
    unparsed: [],
  },
  'amadeus/14-year-wrap-arnk.txt': {
    format: 'amadeus',
    locator: 'Y2WRAP',
    pax: ['1 DOE/JANE MS ADT'],
    segs: [
      '2 AF1381 Y 2026-12-28 LHRCDG 07:15-09:35+0 HK1 rl=PO9IUY',
      '4 AF1680 Y 2027-01-03 ORYNCE 10:00-11:25+0 HK1 rl=PO9IUY',
      '5 BA343 Y 2027-01-05 NCELHR 12:40-13:55+0 HK1 rl=WS2EDC',
    ],
    unparsed: ['1:header', '4:arnk'],
  },
  'amadeus/15-infant-other-surname-umrah-lhe.txt': {
    format: 'amadeus',
    locator: 'P5GHTY',
    pax: [
      '1 MUSTERMANN/MAX MR ADT',
      '1.INF ROE/BABY - INF dob=2026-09-01',
      '2 MUSTERMANN/ERIKA MRS ADT',
    ],
    segs: [
      '3 PK757 Y 2027-01-08 LHEJED 02:30-05:45+0 HK2 rl=HG5FDS',
      '4 PK742 Y 2027-01-21 JEDLHE 14:15-22:15+0 HK2 rl=HG5FDS',
    ],
    unparsed: ['1:header'],
  },

  // ------------------------------------------------------------------ Sabre
  'sabre/01-oneway-single.txt': {
    format: 'sabre',
    locator: 'ZQSABR',
    pax: ['1.1 SAMPLE/JOHN MR ADT'],
    segs: ['1 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1 rl=YT4KQ9'],
    unparsed: ['3:ticketing', '4:ticketing', '5:contact', '6:contact', '7:header', '8:header'],
  },
  'sabre/02-return-family-infant-child.txt': {
    format: 'sabre',
    locator: 'QWLPZX',
    pax: [
      '1.1 TESTER/ALI MR ADT',
      '2.1 TESTER/SARA MRS ADT',
      '3.1 TESTER/OMAR - CHD age=8',
      '4.1 TESTER/ZAINAB - INF dob=2026-03-12',
    ],
    segs: [
      '1 PK757 Y 2026-11-10 LHEJED 02:30-05:45+0 HK3 rl=XKQ7PL',
      '2 PK742 Y 2026-11-24 JEDLHE 14:15-22:15+0 HK3 rl=XKQ7PL',
    ],
    unparsed: ['5:ssr', '6:ssr', '7:ssr', '8:header', '9:header'],
  },
  'sabre/03-multi-city.txt': {
    format: 'sabre',
    pax: ['1.1 EXAMPLE/SOPHIE MS ADT'],
    segs: [
      '1 EK2 Y 2026-11-05 LHRDXB 14:40-00:40+1 HK1 rl=PL3RTA',
      '2 EK412 Y 2026-11-06 DXBSYD 02:15-22:15+0 HK1 rl=PL3RTA',
      '3 QF1 Y 2026-11-20 SYDSIN 15:05-20:40+0 HK1 rl=V9KMDE',
      '4 QF1 Y 2026-11-21 SINLHR 22:15-05:15+1 HK1 rl=V9KMDE',
    ],
    unparsed: [],
  },
  'sabre/04-umrah-lhe-med-group-name.txt': {
    format: 'sabre',
    locator: 'UMRHPK',
    pax: [
      '1.1 QAPASS/USMAN MR ADT',
      '2.1 QAPASS/FATIMA MRS ADT',
      '2.2 QAPASS/ALI MSTR CHD age=10',
      '3.1 QAPASS/NOOR - INF dob=2026-06-20',
    ],
    segs: [
      '1 PK759 Y 2026-12-03 LHEMED 03:00-06:15+0 HK3 rl=MN3BVC',
      '2 PK744 Y 2026-12-20 JEDLHE 12:50-20:45+0 HK3 rl=MN3BVC',
    ],
    unparsed: ['5:remark', '6:remark', '7:remark', '8:header', '9:header'],
  },
  'sabre/05-codeshare.txt': {
    format: 'sabre',
    pax: ['1.1 PLACEHOLDER/ANNA MRS ADT', '2.1 PLACEHOLDER/PETER MR ADT'],
    segs: [
      '1 BA1511 Y 2026-11-12 LHRJFK 09:05-12:10+0 HK2 op=AMERICAN AIRLINES rl=HW2QAZ',
      '2 AA104 Y 2026-11-19 JFKLHR 18:30-06:35+1 HK2 rl=JX7TRE',
      '3 IB7404 Y 2026-11-21 LHRMAD 07:15-10:40+0 HK2 op=BA rl=KL9MNB',
    ],
    unparsed: [],
  },
  'sabre/06-waitlist.txt': {
    format: 'sabre',
    pax: ['1.1 FICTIVE/OMAR MR ADT', '2.1 FICTIVE/HUDA MRS ADT'],
    segs: [
      '1 EK600 Y 2026-12-18 DXBKHI 21:55-01:45+1 HL2',
      '2 EK602 Y 2026-12-18 DXBKHI 10:15-14:10+0 HK2 rl=R2D2QQ',
      '3 EK609 Y 2027-01-02 KHIDXB 04:15-05:40+0 US2',
      '4 EK607 Y 2027-01-02 KHIDXB 10:15-11:40+0 KL2 rl=R2D2QQ',
    ],
    unparsed: [],
  },
  'sabre/07-cancelled-schedule-change.txt': {
    format: 'sabre',
    pax: ['1.1 NOBODY/ALEX MR ADT'],
    segs: [
      '1 TK1980 Y 2026-11-03 LHRIST 11:35-17:35+0 UN1',
      '2 TK1986 Y 2026-11-03 LHRIST 13:40-19:45+0 TK1 rl=QA5SDF',
      '3 TK94 Y 2026-11-03 ISTJED 20:50-00:35+1 HX1',
      '4 TK96 Y 2026-11-04 ISTJED 01:55-05:40+0 TK1 rl=QA5SDF',
      '5 TK95 Y 2026-11-18 JEDIST 07:00-10:50+0 XX1',
    ],
    unparsed: [],
  },
  'sabre/08-24-hour-times.txt': {
    format: 'sabre',
    pax: ['1.1 ROE/RICHARD MR ADT'],
    segs: [
      '1 LH901 Y 2026-11-14 LHRFRA 07:20-09:55+0 HK1 rl=Y8UIOP',
      '2 LH630 Y 2026-11-14 FRAJED 13:50-19:45+0 HK1 rl=Y8UIOP',
    ],
    unparsed: [],
  },
  'sabre/09-umrah-isb-jed-infant.txt': {
    format: 'sabre',
    pax: [
      '1.1 EXAMPLE/HASSAN MR ADT',
      '2.1 EXAMPLE/ZARA MRS ADT',
      '3.1 EXAMPLE/AYAN MSTR INF dob=2026-01-10',
    ],
    segs: [
      '1 SV727 Y 2027-01-09 ISBJED 03:45-07:00+0 HK2 rl=TR5EWQ',
      '2 SV726 Y 2027-01-23 MEDISB 18:20-01:55+1 HK2 rl=TR5EWQ',
    ],
    unparsed: ['5:ssr', '6:ssr'],
  },
  'sabre/10-umrah-khi-lowercase.txt': {
    format: 'sabre',
    pax: ['1.1 MOCK/BILAL MR ADT', '2.1 MOCK/SANA MRS ADT'],
    segs: [
      '1 SV705 Y 2027-02-11 KHIJED 04:05-06:55+0 HK2 rl=LK8JHG',
      '2 SV704 Y 2027-02-25 JEDKHI 20:50-04:20+1 HK2 rl=LK8JHG',
    ],
    unparsed: [],
  },
  'sabre/11-wrapped-lines.txt': {
    format: 'sabre',
    pax: ['1.1 DOE/JANE MS ADT'],
    segs: [
      '1 VS3 Y 2026-12-03 LHRJFK 08:30-11:40+0 HK1 rl=ABQ2RT',
      '2 VS4 Y 2026-12-10 JFKLHR 18:30-06:30+1 HK1 rl=ABQ2RT',
    ],
    unparsed: [],
    warnings: ['WRAPPED_LINE_JOINED@2', 'WRAPPED_LINE_JOINED@4'],
  },
  'sabre/12-sections-and-garbage.txt': {
    format: 'sabre',
    locator: 'BGFRED',
    pax: ['1.1 BLOGGS/FRED MR ADT'],
    segs: [
      '1 LH901 Y 2026-11-14 LHRFRA 07:20-09:55+0 HK1 rl=Y8UIOP',
      '2 LH630 Y 2026-11-14 FRAJED 13:50-19:45+0 HK1 rl=Y8UIOP',
    ],
    unparsed: [
      '4:ticketing',
      '5:ticketing',
      '6:contact',
      '7:contact',
      '8:contact',
      '9:contact',
      '10:ssr',
      '11:ssr',
      '12:osi',
      '13:remark',
      '14:remark',
      '15:remark',
      '16:unknown',
      '17:unknown',
      '18:header',
      '19:header',
    ],
  },
  'sabre/13-noon-midnight.txt': {
    format: 'sabre',
    pax: ['1.1 DOE/JOHN MR ADT'],
    segs: [
      '1 AA100 Y 2026-12-07 JFKLHR 00:00-12:00+0 HK1 rl=NN4MMX',
      '2 AA101 Y 2026-12-14 LHRJFK 12:00-15:05+0 HK1 rl=NN4MMX',
    ],
    unparsed: [],
  },
  'sabre/14-joined-title-adt-dr.txt': {
    format: 'sabre',
    pax: ['1.1 SAMPLE/JOHN MR ADT', '2.1 SAMPLE/EMMA DR ADT'],
    segs: [
      '1 QR8 Y 2027-01-12 LHRDOH 14:25-23:45+0 HK2 rl=VB7NMQ',
      '2 QR948 Y 2027-01-13 DOHKUL 02:05-16:25+0 HK2 rl=VB7NMQ',
    ],
    unparsed: [],
  },
  'sabre/15-double-dagger-group.txt': {
    format: 'sabre',
    pax: ['1.1 DUMMY/AHMED MR ADT', '1.2 DUMMY/BILAL MR ADT', '1.3 DUMMY/CHAND MR ADT'],
    segs: [
      '1 EY20 Y 2027-01-15 MANAUH 21:20-08:25+1 HK3 rl=QP0OIU',
      '2 EY333 Y 2027-01-16 AUHJED 09:40-11:55+0 HK3 rl=QP0OIU',
    ],
    unparsed: [],
  },

  'sabre/16-ia-arrival-date-arnk.txt': {
    format: 'sabre',
    pax: ['1.1 SAMPLE/JOHN MR ADT'],
    segs: [
      '1 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1 rl=YT4KQ9',
      '3 BA112 Y 2026-12-22 JFKLHR 19:00-06:55+1 HK1 rl=YT4KQ9',
    ],
    unparsed: ['1:header', '4:arnk'],
  },

  // ---------------------------------------------------------------- Galileo
  'galileo/01-oneway-single.txt': {
    format: 'galileo',
    locator: 'ZQGAL1',
    pax: ['1.1 SAMPLE/JOHN MR ADT'],
    segs: ['1 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1'],
    unparsed: ['1:header', '4:contact', '5:ticketing'],
  },
  'galileo/02-return-overnight.txt': {
    format: 'galileo',
    locator: 'R8GALX',
    pax: ['1.1 DOE/JAMES MR ADT', '2.1 DOE/MARY MRS ADT'],
    segs: [
      '1 EK18 Y 2026-11-20 MANDXB 14:15-00:30+1 HK2',
      '2 EK17 Y 2026-12-04 DXBMAN 07:45-11:50+0 HK2',
    ],
    unparsed: ['1:header'],
  },
  'galileo/03-multi-city.txt': {
    format: 'galileo',
    locator: 'K2GALM',
    pax: ['1.1 EXAMPLE/SOPHIE MS ADT'],
    segs: [
      '1 TG917 Y 2026-11-05 LHRBKK 21:30-15:20+1 HK1',
      '2 TG475 Y 2026-11-08 BKKSYD 18:05-07:05+1 HK1',
      '3 QF35 Y 2026-11-20 SYDSIN 15:20-21:05+0 HK1',
      '4 SQ322 Y 2026-11-22 SINLHR 23:35-06:15+1 HK1',
    ],
    unparsed: ['1:header'],
  },
  'galileo/04-umrah-man-jed-family.txt': {
    format: 'galileo',
    locator: 'U7GALU',
    pax: [
      '1.1 TESTCASE/IMRAN MR ADT',
      '2.1 TESTCASE/AISHA MRS ADT',
      '3.1 TESTCASE/YUSUF MSTR CHD age=9',
      '4.1 TESTCASE/MARYAM MISS CHD age=7',
      '5.1 TESTCASE/HAMZA MSTR INF dob=2026-02-15',
    ],
    segs: [
      '1 EY20 Y 2026-12-22 MANAUH 21:20-08:25+1 HK4',
      '2 EY333 Y 2026-12-23 AUHJED 09:40-11:55+0 HK4',
      '3 EY336 Y 2027-01-06 MEDAUH 13:00-16:50+0 HK4',
      '4 EY19 Y 2027-01-06 AUHMAN 20:50-01:30+1 HK4',
    ],
    unparsed: ['1:header', '9:ssr', '10:ssr', '11:remark'],
  },
  'galileo/05-codeshare.txt': {
    format: 'galileo',
    locator: 'T4GALC',
    pax: ['1.1 PLACEHOLDER/ANNA MRS ADT', '2.1 PLACEHOLDER/PETER MR ADT'],
    segs: [
      '1 BA1511 Y 2026-11-12 LHRJFK 09:05-12:10+0 HK2 op=AMERICAN AIRLINES',
      '2 AA104 Y 2026-11-19 JFKLHR 18:30-06:35+1 HK2',
    ],
    unparsed: ['1:header'],
  },
  'galileo/06-waitlist-cancelled.txt': {
    format: 'galileo',
    locator: 'W5GALW',
    pax: ['1.1 FICTIVE/OMAR MR ADT'],
    segs: [
      '1 EK600 Y 2026-12-18 DXBKHI 21:55-01:45+1 HL1',
      '2 EK602 Y 2026-12-18 DXBKHI 10:15-14:10+0 HK1',
      '3 EK609 Y 2027-01-02 KHIDXB 04:15-05:40+0 UC1',
      '4 EK607 Y 2027-01-02 KHIDXB 10:15-11:40+0 XX1',
      '5 EK601 Y 2027-01-03 KHIDXB 21:30-22:55+0 NO1',
    ],
    unparsed: ['1:header'],
  },
  'galileo/07-umrah-via-ist-group-name.txt': {
    format: 'galileo',
    locator: 'H8GALT',
    pax: ['1.1 NOBODY/ALEX MR ADT', '1.2 NOBODY/SAMIRA MRS ADT'],
    segs: [
      '1 TK1986 Y 2026-11-03 LHRIST 13:40-19:45+0 HK2',
      '2 TK96 Y 2026-11-04 ISTJED 01:55-05:40+0 HK2',
      '3 TK95 Y 2026-11-18 JEDIST 07:00-10:50+0 HK2',
      '4 TK1983 Y 2026-11-18 ISTLHR 15:40-17:50+0 HK2',
    ],
    unparsed: ['1:header'],
  },
  'galileo/08-equipment.txt': {
    format: 'galileo',
    locator: 'E9GALQ',
    pax: ['1.1 ROE/RICHARD MR ADT'],
    segs: [
      '1 EK2 Y 2026-11-05 LHRDXB 14:40-00:40+1 HK1 eq=77W',
      '2 EK412 Y 2026-11-06 DXBSYD 02:15-22:15+0 HK1 eq=388',
      '3 QF1 Y 2026-11-20 SYDLHR 15:45-05:05+1 HK1 eq=789',
    ],
    unparsed: ['1:header'],
  },
  'galileo/09-lowercase-tabs-spaces.txt': {
    format: 'galileo',
    locator: 'M4GALZ',
    pax: ['1.1 DUMMY/SARAH MS ADT', '2.1 DUMMY/TOM MR ADT'],
    segs: [
      '1 BA287 Y 2026-11-09 LHRSFO 11:35-14:50+0 HK2',
      '2 BA286 Y 2026-11-16 SFOLHR 20:10-14:25+1 HK2',
    ],
    unparsed: ['1:header'],
  },
  'galileo/10-wrapped-lines.txt': {
    format: 'galileo',
    locator: 'J9GALW',
    pax: ['1.1 EXAMPLE/LIAM MR ADT'],
    segs: [
      '1 VS3 Y 2026-12-03 LHRJFK 08:30-11:40+0 HK1',
      '2 VS4 Y 2026-12-10 JFKLHR 18:30-06:30+1 HK1',
    ],
    unparsed: ['1:header'],
    warnings: ['WRAPPED_LINE_JOINED@3', 'WRAPPED_LINE_JOINED@5'],
  },
  'galileo/11-fields-and-garbage.txt': {
    format: 'galileo',
    locator: 'G4GALB',
    pax: ['1.1 BLOGGS/FRED MR ADT'],
    segs: [
      '1 LH901 Y 2026-11-14 LHRFRA 07:20-09:55+0 HK1',
      '2 LH630 Y 2026-11-14 FRAJED 13:50-19:45+0 HK1',
    ],
    unparsed: [
      '1:header',
      '2:header',
      '6:contact',
      '7:contact',
      '8:contact',
      '9:ticketing',
      '10:remark',
      '11:ssr',
      '12:unknown',
      '13:unknown',
    ],
  },
  'galileo/12-labelled-locator.txt': {
    format: 'galileo',
    locator: 'N3GALR',
    pax: [],
    segs: [
      '1 PK785 Y 2026-12-05 ISBLHR 09:00-13:30+0 HK1',
      '2 PK786 Y 2026-12-12 LHRISB 15:30-06:10+1 HK1',
    ],
    unparsed: ['1:header'],
  },
  'galileo/13-plus-two-days.txt': {
    format: 'galileo',
    locator: 'B6GALD',
    pax: ['1.1 ROE/RICHARD MR ADT'],
    segs: ['1 SQ26 J 2026-12-19 JFKSIN 21:40-07:40+2 HK1'],
    unparsed: ['1:header'],
  },
  'galileo/14-multiword-surnames-chd.txt': {
    format: 'galileo',
    locator: 'V1GALN',
    pax: [
      '1.1 VAN DER TEST/ANNA MS ADT',
      '2.1 VAN DER TEST/PIM MSTR CHD',
      '3.1 O NEILL/KIERAN MR ADT',
    ],
    segs: ['1 KL1007 Y 2026-11-20 AMSLHR 07:00-07:20+0 HK3'],
    unparsed: ['1:header'],
  },

  // ------------------------------------------------------------------ Mixed
  'mixed/01-not-a-pnr.txt': {
    format: 'unknown',
    pax: [],
    segs: [],
    unparsed: ['1:unknown', '2:unknown', '3:header', '4:unknown'],
    warnings: ['NO_SEGMENTS@-', 'UNKNOWN_FORMAT@-'],
  },
  'mixed/02-no-segment-numbers.txt': {
    format: 'amadeus',
    segs: [
      '1 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1',
      '2 BA112 Y 2026-12-22 JFKLHR 19:00-06:55+1 HK1',
    ],
    unparsed: [],
    warnings: ['SEGMENT_NUMBER_MISSING@1', 'SEGMENT_NUMBER_MISSING@2'],
  },
  'mixed/03-empty.txt': {
    format: 'unknown',
    pax: [],
    segs: [],
    unparsed: [],
    warnings: ['EMPTY_INPUT@-'],
  },
  'mixed/04-forced-wrong-format.txt': {
    format: 'sabre',
    locator: 'ZQ7TKD',
    pax: ['1 SAMPLE/JOHN MR ADT'],
    segs: ['2 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1 rl=YT4KQ9'],
    unparsed: ['1:header'],
    warnings: ['FORMAT_MISMATCH@-', 'FORMAT_MISMATCH@3'],
  },
  'mixed/05-leap-day.txt': {
    format: 'galileo',
    segs: ['1 BA117 Y 2028-02-29 LHRJFK 10:20-13:15+0 HK1'],
    unparsed: [],
    warnings: ['LOW_CONFIDENCE@-', 'INVALID_DATE@1'],
  },
  'mixed/06-trip-already-started.txt': {
    format: 'amadeus',
    locator: 'K2LATE',
    pax: ['1 EXAMPLE/SOPHIE MS ADT'],
    segs: [
      '2 EK2 Y 2027-11-05 LHRDXB 14:40-00:40+1 HK1',
      '3 EK1 Y 2026-11-20 DXBLHR 08:00-12:25+0 HK1',
    ],
    unparsed: ['1:header'],
    warnings: ['DAY_OF_WEEK_MISMATCH@3', 'NON_CHRONOLOGICAL@4'],
  },
  'mixed/07-bad-fields.txt': {
    format: 'galileo',
    segs: [
      '1 BA117 Y 2026-12-15 LHRJFK ?-13:15+0 HK1',
      '2 BA112 Y 2026-12-22 JFKLHR 19:00-06:55+1 ZZ1',
      '3 BA113 Y 2026-12-23 JFKLHR ?-?+0 --',
    ],
    unparsed: [],
    warnings: [
      'INVALID_TIME@1',
      'UNKNOWN_STATUS@2',
      'SEGMENT_FIELD_MISSING@3',
      'SEGMENT_FIELD_MISSING@3',
      'SEGMENT_FIELD_MISSING@3',
    ],
  },
  'mixed/08-no-itinerary.txt': {
    format: 'amadeus',
    locator: 'N0SEGS',
    pax: ['1 SAMPLE/JOHN MR ADT'],
    segs: [],
    unparsed: ['1:header', '3:contact', '4:ticketing', '5:ssr'],
    warnings: ['NO_SEGMENTS@-'],
  },
  'mixed/09-unreadable-name-item.txt': {
    format: 'sabre',
    pax: ['1.1 SAMPLE/JOHN MR ADT'],
    segs: ['1 BA117 Y 2026-12-15 LHRJFK 10:20-13:15+0 HK1'],
    unparsed: [],
    warnings: ['NAME_UNPARSED@1'],
  },
};

const fixtures = loadFixtures();

describe('fixture set', () => {
  it('has at least 40 fixtures spread across the three formats', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(40);
    for (const dir of ['galileo', 'sabre', 'amadeus']) {
      expect(fixtures.filter((f) => f.name.startsWith(`${dir}/`)).length).toBeGreaterThanOrEqual(
        10,
      );
    }
  });

  it('has an expectation for every fixture and a fixture for every expectation', () => {
    expect(fixtures.map((f) => f.name).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});

describe.each(fixtures)('$name', (fixture) => {
  const result = parsePnr(fixture.text, {
    referenceDate: fixture.referenceDate,
    ...(fixture.format ? { format: fixture.format } : {}),
  });
  const exp = EXPECTED[fixture.name];

  it('matches the expected format', () => {
    expect(exp).toBeDefined();
    expect(result.format).toBe(exp!.format);
    if (!fixture.name.startsWith('mixed/')) expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('reads the record locator', () => {
    expect(result.recordLocator).toBe(exp!.locator);
  });

  it('reads passengers', () => {
    expect(result.passengers.map(paxSig)).toEqual(exp!.pax ?? []);
  });

  it('reads segments', () => {
    expect(result.segments.map(segSig)).toEqual(exp!.segs);
  });

  it('keeps every other line in unparsedLines', () => {
    expect(result.unparsedLines.map((u) => `${u.line}:${u.category}`)).toEqual(exp!.unparsed ?? []);
  });

  it('reports exactly the expected warnings', () => {
    expect(result.warnings.map((w) => `${w.code}@${w.line ?? '-'}`)).toEqual(exp!.warnings ?? []);
  });
});
