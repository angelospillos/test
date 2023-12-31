import type { IconName } from '../../types/icons';
import type { SvgIconProps } from '@mui/material/SvgIcon';

import * as I from '../../theme/icons';

export const icons = {
  addCircle: I.AddCircleIcon,
  addComponent: I.AddComponentIcon,
  addGroup: I.AddGroupIcon,
  add: I.AddIcon,
  addUser: I.AddUserIcon,
  alert: I.AlertIcon,
  alertsArrow: I.AlertsArrowIcon,
  answerPrompt: I.AnswerPromptIcon,
  arrowBackRounded: I.ArrowBackRoundedIcon,
  arrowDown: I.ArrowDownIcon,
  arrowLeft: I.ArrowLeftIcon,
  arrowPixel: I.ArrowPixelIcon,
  autoRetry: I.AutoRetryIcon,
  back: I.BackIcon,
  breakpoint: I.BreakpointIcon,
  calendar: I.CalendarIcon,
  cart: I.CartIcon,
  changeInput: I.ChangeInputIcon,
  checkCircle: I.CheckCircleIcon,
  check: I.CheckIcon,
  checkRegular: I.CheckRegularIcon,
  chevronDown: I.ChevronDown,
  chevronRight: I.ChevronRightIcon,
  chevronsDown: I.ChevronsDown,
  chevronsUp: I.ChevronsUp,
  chromeStore: I.ChromeStoreIcon,
  circle: I.CircleIcon,
  clearAll: I.ClearAllIcon,
  clearInput: I.ClearInputIcon,
  click: I.ClickIcon,
  clock: I.ClockIcon,
  clone: I.CloneIcon,
  close: I.CloseIcon,
  closeTab: I.CloseTabIcon,
  cloud: I.CloudIcon,
  cloudRun: I.CloudRunIcon,
  coffeePixel: I.CoffeePixelIcon,
  component: I.ComponentIcon,
  computer: I.ComputerIcon,
  contact: I.ContactIcon,
  context: I.ContextIcon,
  copy: I.CopyIcon,
  cornerDownRight: I.CornerDownRightIcon,
  dblClick: I.DblClickIcon,
  delete: I.DeleteIcon,
  desktop: I.DesktopIcon,
  discord: I.DiscordIcon,
  dot: I.DotIcon,
  download: I.DownloadIcon,
  dragAndDrop: I.DragAndDropIcon,
  drag: I.DragIcon,
  dropdownSelect: I.DropdownSelectIcon,
  edit: I.EditIcon,
  email: I.EmailIcon,
  error: I.ErrorIcon,
  errorTriangle: I.ErrorTriangleIcon,
  exists: I.ExistsIcon,
  expanded: I.ExpandedIcon,
  externalLink: I.ExternalLinkIcon,
  eye: I.EyeIcon,
  eyeNotVisible: I.EyeNotVisibleIcon,
  eyeText: I.EyeTextIcon,
  eyeTextNotVisible: I.EyeTextNotVisibleIcon,
  file: I.FileIcon,
  formatListBulleted: I.FormatListBulletedIcon,
  fullScreen: I.FullScreenIcon,
  gettingStarted: I.GettingStartedIcon,
  goToBrowser: I.GoToBrowserIcon,
  hash: I.HashIcon,
  help: I.HelpIcon,
  history: I.HistoryIcon,
  hover: I.HoverIcon,
  info: I.InfoIcon,
  inputCheck: I.InputCheckIcon,
  inputChecked: I.InputCheckedIcon,
  inputType: I.InputTypeIcon,
  inputUnchecked: I.InputUncheckedIcon,
  integrations: I.IntegrationsIcon,
  jS: I.JSIcon,
  jira: I.JiraIcon,
  keyBold: I.KeyBoldIcon,
  key: I.KeyIcon,
  keyboard: I.KeyboardIcon,
  label: I.LabelIcon,
  labelOff: I.LabelOffIcon,
  layersClear: I.LayersClearIcon,
  layers: I.LayersIcon,
  link2: I.Link2Icon,
  linkOff: I.LinkOffIcon,
  listCount: I.ListCountIcon,
  lock: I.LockIcon,
  logout: I.LogoutIcon,
  mail: I.MailIcon,
  menu: I.MenuIcon,
  minimize: I.MinimizeIcon,
  mobile: I.MobileIcon,
  moneyCircle: I.MoneyCircleIcon,
  money: I.MoneyIcon,
  moneyPixel: I.MoneyPixelIcon,
  monitorParagraph: I.MonitorParagraphIcon,
  monitorText: I.MonitorTextIcon,
  monitorTextNotVisible: I.MonitorTextNotVisibleIcon,
  more: I.MoreIcon,
  newTab: I.NewTabIcon,
  next: I.NextIcon,
  notExists: I.NotExistsIcon,
  npm: I.NpmIcon,
  offline: I.OfflineIcon,
  openWindow: I.OpenWindowIcon,
  organization: I.OrganizationIcon,
  paste: I.PasteIcon,
  pause: I.PauseIcon,
  play: I.PlayIcon,
  pressMouseButton: I.PressMouseButtonIcon,
  refresh: I.RefreshIcon,
  releaseMouseButton: I.ReleaseMouseButtonIcon,
  remove: I.RemoveIcon,
  report: I.ReportIcon,
  rightClick: I.RightClickIcon,
  save: I.SaveIcon,
  schedule: I.ScheduleIcon,
  scroll: I.ScrollIcon,
  search: I.SearchIcon,
  settings: I.SettingsIcon,
  settingsSmaller: I.SettingsSmallerIcon,
  slack: I.SlackIcon,
  sleep: I.SleepIcon,
  smallDot: I.SmallDotIcon,
  sort: I.SortIcon,
  split: I.SplitIcon,
  stop: I.StopIcon,
  subjectRounded: I.SubjectRoundedIcon,
  suites: I.SuitesIcon,
  switch: I.SwitchIcon,
  teams: I.TeamsIcon,
  terminal: I.TerminalIcon,
  tests: I.TestsIcon,
  thumbDown: I.ThumbDownIcon,
  tool: I.ToolIcon,
  trashRemove: I.TrashRemoveIcon,
  upload: I.UploadIcon,
  url: I.UrlIcon,
  user: I.UserIcon,
  userSimple: I.UserSimpleIcon,
  variablesExtension: I.VariablesExtensionIcon,
  variables: I.VariablesIcon,
  webhook: I.WebhookIcon,
};

interface IconProps extends SvgIconProps {
  name: IconName;
}

const Icon = ({ name, ...props }: IconProps) => {
  const SelectedIcon = icons[name];
  const dataTestId = `${name.charAt(0).toUpperCase()}${name.slice(1)}Icon`;

  return (
    <SelectedIcon arial-label={name} data-testid={dataTestId} role="graphics-symbol" {...props} />
  );
};

export default Icon;
