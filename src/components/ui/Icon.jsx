/**
 * Material Symbols Rounded icon wrapper.
 * Maps legacy Lucide icon names to Google Material Symbols
 * so every consumer can switch with minimal churn.
 *
 * Usage: <Icon name="search" size={18} />
 */
const MAP = {
  alert_circle: 'notification_important',
  alert_triangle: 'warning',
  archive: 'archive',
  arrow_left: 'arrow_back',
  arrow_right: 'arrow_forward',
  arrow_up_right: 'north_east',
  audio_lines: 'graphic_eq',
  badge_check: 'verified',
  badge_dollar_sign: 'paid',
  banknote: 'account_balance_wallet',
  bell: 'notifications',
  bell_ring: 'notifications_active',
  briefcase: 'work',
  briefcase_business: 'corporate_fare',
  building2: 'apartment',
  calendar_clock: 'schedule',
  calendar_days: 'calendar_month',
  check: 'check',
  check_check: 'done_all',
  check_circle2: 'check_circle',
  circle: 'radio_button_unchecked',
  circle_alert: 'error',
  circle_dollar_sign: 'monetization_on',
  circle_user_round: 'account_circle',
  clipboard_list: 'assignment',
  clock3: 'schedule',
  compass: 'explore',
  contact_round: 'contacts',
  copy: 'content_copy',
  download: 'download',
  eye: 'visibility',
  eye_off: 'visibility_off',
  external_link: 'open_in_new',
  file: 'description',
  file_check2: 'task_alt',
  file_image: 'image',
  file_plus2: 'note_add',
  file_spreadsheet: 'table_chart',
  file_text: 'article',
  file_up: 'upload_file',
  folder_kanban: 'folder_special',
  gauge: 'speed',
  globe2: 'public',
  hand_coins: 'handshake',
  help_circle: 'help',
  history: 'history',
  home: 'home',
  image: 'image',
  info: 'info',
  key_round: 'key',
  layers3: 'layers',
  layout_dashboard: 'dashboard',
  lightbulb: 'lightbulb',
  line_chart: 'show_chart',
  link2: 'link',
  loader: 'hourglass_empty',
  loader_circle: 'autorenew',
  lock_keyhole: 'lock',
  log_in: 'login',
  log_out: 'logout',
  mail: 'mail',
  maximize2: 'aspect_ratio',
  megaphone: 'campaign',
  menu: 'menu',
  message_circle: 'chat_bubble',
  message_square: 'chat',
  message_square_text: 'chat_bubble',
  monitor_smartphone: 'devices',
  more_horizontal: 'more_horiz',
  move_up_right: 'open_in_new',
  package_check: 'package_2',
  palette: 'palette',
  panels_top_left: 'web',
  paperclip: 'attach_file',
  pencil: 'edit',
  phone: 'phone',
  plus: 'add',
  plus_circle: 'add_circle',
  receipt_text: 'receipt',
  refresh_cw: 'autorenew',
  rotate_ccw: 'restart_alt',
  save: 'save',
  search: 'search',
  send: 'send',
  settings: 'settings',
  settings2: 'tune',
  share2: 'share',
  shield_check: 'verified_user',
  sliders_horizontal: 'tune',
  smartphone: 'smartphone',
  sparkles: 'auto_awesome',
  star: 'star',
  target: 'target',
  timer: 'timer',
  trash2: 'delete',
  upload_cloud: 'cloud_upload',
  user_round: 'person',
  users_round: 'people',
  video: 'videocam',
  wallet_cards: 'wallet',
  workflow: 'account_tree',
  x: 'close',
  x_circle: 'cancel',
};

/**
 * Convert a PascalCase Lucide name to a snake_case key.
 * e.g. "CheckCircle2" → "check_circle2"
 */
function toKey(pascal) {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Resolves a Lucide-style name or a raw Material Symbol name.
 * If the name contains an underscore it is treated as a
 * Material Symbol key directly.
 */
function resolveName(input) {
  if (!input) return 'help';
  if (input.includes('_')) {
    return MAP[input] || input;
  }
  return MAP[toKey(input)] || toKey(input);
}

export default function Icon({
  name,
  size = 18,
  className = '',
  color,
  fill,
  'aria-hidden': ariaHidden = 'true',
  style: styleProp,
  ...rest
}) {
  const symbol = resolveName(name);

  const style = {
    fontSize: size,
    lineHeight: 1,
    color: color || undefined,
    verticalAlign: 'middle',
    ...styleProp,
  };

  if (fill !== undefined && fill !== 'none') {
    style.fontVariationSettings = "'FILL' 1";
  } else if (fill === 'none') {
    style.fontVariationSettings = "'FILL' 0";
  }

  return (
    <span
      className={`material-symbols-rounded ${className}`.trim()}
      style={style}
      aria-hidden={ariaHidden}
      {...rest}
    >
      {symbol}
    </span>
  );
}
