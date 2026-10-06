import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import common from './en/common.json'
import talently from './en/talently.json'
import people from './en/people.json'
import onboard from './en/onboard.json'
import time from './en/time.json'
import settings from './en/settings.json'
import careers from './en/careers.json'
import templates from './en/templates.json'
import ats from './en/ats.json'
import approvals from './en/approvals.json'
import auth from './en/auth.json'

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'talently', 'people', 'onboard', 'time', 'settings', 'auth', 'careers', 'templates', 'ats', 'approvals'],
  defaultNS: 'common',
  resources: {
  en: { common, talently, people, onboard, time, settings, auth, careers, templates, ats, approvals },
},
  interpolation: { escapeValue: false },
})

export default i18n