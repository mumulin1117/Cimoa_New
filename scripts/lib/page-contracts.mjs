// Offline planning metadata. No prototype runtime code is used by the app.
const groups = [
  ['splash welcome', 'root', 'welcome'],
  ['home photo events', 'tab', 'home'],
  ['age login', 'secondary', 'welcome'],
  ['agree', 'tertiary', 'age'], ['signup', 'tertiary', 'agree'],
  ['verEmail', 'tertiary', 'signup login reverify'], ['verCode verUnsupported', 'tertiary', 'verEmail'],
  ['verSuccess', 'state', 'verCode'], ['fpEmail', 'tertiary', 'login'],
  ['fpCode', 'tertiary', 'fpEmail'], ['fpNew', 'tertiary', 'fpCode'],
  ['obBasic', 'tertiary', 'verSuccess'], ['obUni', 'tertiary', 'obBasic'],
  ['obMajor', 'tertiary', 'obUni'], ['obPhotos', 'tertiary', 'obMajor'],
  ['obAbout', 'tertiary', 'obPhotos'], ['obInterests', 'tertiary', 'obAbout'],
  ['obGoal', 'tertiary', 'obInterests'], ['obIce', 'tertiary', 'obGoal'],
  ['obNotif', 'tertiary', 'obIce'], ['obComplete', 'state', 'obNotif'],
  ['permPhotos permCamera', 'tertiary', 'obPhotos editAll chat evGroup'],
  ['permMic', 'tertiary', 'ibVoice editAll'], ['permNotif', 'tertiary', 'obNotif setPerm'],
  ['expanded', 'secondary', 'photo chat evParticipants amFound'],
  ['ibSelect', 'secondary', 'photo expanded evParticipants'],
  ['ibText ibVoice', 'tertiary', 'ibSelect'], ['ibPreview', 'tertiary', 'ibVoice'],
  ['reqSent', 'state', 'ibText ibPreview'], ['reqReceived', 'secondary', 'home'],
  ['reqAccepted reqDeclined', 'state', 'reqReceived'],
  ['amEntry', 'secondary', 'home'], ['amPrefs', 'tertiary', 'amEntry photo amNoMatch'],
  ['amSearching', 'tertiary', 'amEntry home'], ['amPaused', 'state', 'amSearching home'],
  ['amFound', 'secondary', 'home amSearching amHistory'], ['amWaiting', 'state', 'amFound home'],
  ['amConnected amPassed amExpired', 'state', 'amFound amWaiting'],
  ['amNoMatch', 'state', 'amSearching'], ['amHistory', 'tertiary', 'amEntry amSearching'],
  ['chat', 'secondary', 'home reqAccepted amConnected'], ['callIncoming callActive callEnded', 'tertiary', 'chat'],
  ['evDetail', 'secondary', 'events evUpcoming'], ['evJoinSuccess', 'state', 'evDetail'],
  ['evParticipants', 'tertiary', 'evDetail evGroup'], ['evGroup', 'tertiary', 'evDetail evUpcoming evJoinSuccess'],
  ['evUpcoming', 'secondary', 'events'], ['evReport', 'tertiary', 'evDetail evGroup'],
  ['coinStore', 'tertiary', 'profile ibPreview amEntry amSearching'],
  ['coinPurchasing coinApple coinSuccess coinFailed coinCancelled', 'state', 'coinStore'],
  ['coinProcessing coinSpendFailed', 'state', 'ibPreview amSearching'],
  ['coinHistory coinHelp', 'tertiary', 'coinStore'], ['coinPurchaseDetail coinSpendDetail', 'tertiary', 'coinHistory'],
  ['profile', 'secondary', 'home'], ['profilePreview editAll verified reverify settings', 'tertiary', 'profile'],
  ['editBasic editInterests editGoals editPrefs editIce', 'tertiary', 'editAll'],
  ['setNotif setPrivacy setPerm setLang blockedList setSupport setLegal delInfo reportsSubmitted', 'tertiary', 'settings'],
  ['legalTerms legalPrivacy', 'tertiary', 'setLegal welcome signup'],
  ['delReason', 'tertiary', 'delInfo'], ['delFinal', 'tertiary', 'delReason'], ['delSuccess', 'state', 'welcome'],
  ['reportDetail', 'tertiary', 'reportsSubmitted'], ['safetyReport', 'tertiary', 'chat expanded amFound evParticipants'],
  ['sysLoading sysOffline sysError sysMaintenance sysEmpty sysPermDenied sysSessionExpired', 'state', 'home photo events'],
]
export const page_contracts = Object.fromEntries(groups.flatMap(([keys, level, parents]) => keys.split(' ').map((key) => [key, { level, parents: parents.split(' ') }])))
export const level_labels = { root: '认证根页', tab: '主 Tab', secondary: '二级', tertiary: '三级', state: '流程状态页' }
export const sheet_owners = {
  sheetCoinConfirm: ['ibPreview'], sheetInsufficient: ['ibPreview', 'amSearching', 'amEntry'],
  sheetSafety: ['chat'], sheetSafetyMini: ['expanded', 'amFound'], sheetBlock: ['chat', 'expanded'],
  sheetMic: ['ibVoice', 'editAll'], sheetLeaving: ['amSearching'], sheetAccepting: ['amFound'],
  sheetBoost: ['amSearching'], sheetAmHelp: ['amSearching'], sheetAmFoundLeave: ['amFound'],
  sheetEvMore: ['evDetail'], sheetVoiceDiscard: ['ibVoice'], sheetIceLibrary: ['obIce', 'editIce'],
  sheetIceCustom: ['obIce', 'editIce'], sheetUniPicker: ['amPrefs'], sheetInterestsPicker: ['amPrefs'],
  sheetEvJoin: ['evDetail'], sheetEvCancel: ['evDetail'], sheetVoiceCoin: ['ibPreview'],
  sheetLogout: ['settings'], unblockOpen: ['blockedList'], isLegalDoc: ['legalTerms', 'legalPrivacy'],
  showTabs: ['home', 'photo', 'events'], hasNotif: ['home', 'photo', 'events'],
}
export function parameters_for(key) {
  if (/^call|^chat$/.test(key)) return ['conversation_id']
  if (/^req/.test(key)) return ['request_id']
  if (/^am/.test(key) && !['amEntry', 'amPrefs', 'amHistory'].includes(key)) return ['match_id']
  if (/^ib/.test(key)) return ['user_id', 'draft_id (after question selection)']
  if (key === 'expanded') return ['user_id']
  if (/^ev/.test(key) && !['events', 'evUpcoming'].includes(key)) return ['event_id', ...(key === 'evGroup' ? ['conversation_id'] : [])]
  if (['coinPurchaseDetail', 'coinSpendDetail'].includes(key)) return ['transaction_id']
  if (/^coin(Purchasing|Apple|Success|Failed|Cancelled)$/.test(key)) return ['purchase_request_id']
  if (/^coin/.test(key)) return ['return_context_id (optional; Store draft ID, never an arbitrary URL)']
  if (key === 'safetyReport') return ['target_user_id', 'context_id']
  if (key === 'reportDetail') return ['report_id']
  if (/^ver|^fp|^ob/.test(key)) return ['auth_flow_id']
  return []
}
export function completion_for(key) {
  if (['login', 'obComplete'].includes(key)) return '认证持久化成功 → 准备三 Tab 单次骨架 → reLaunch /pages/home/index'
  if (key === 'fpNew') return '真实密码重置成功 → reLaunch /pages/auth/login'
  if (key === 'reqSent') return 'Done → reLaunch /pages/discover/index'
  if (['reqAccepted', 'reqDeclined'].includes(key)) return 'Done → reLaunch /pages/home/index；Chat 仅传本次 request_id 派生的 conversation_id'
  if (key === 'delSuccess') return 'reLaunch /pages/auth/welcome；不返回已删除账号'
  if (key === 'settings') return '退出成功 → reLaunch /pages/auth/welcome'
  if (key === 'sysSessionExpired') return '清理失效会话 → reLaunch /pages/auth/welcome'
  if (/^am/.test(key) && !['amEntry', 'amPrefs', 'amHistory'].includes(key)) return '确认退出/完成 → reLaunch /pages/home/index；不得恢复结束会话'
  if (/^call/.test(key)) return '仅等待接通模拟；结束只 pop 一次至原 conversation_id 的聊天'
  return '成功留在本流程；返回 pop 当前层并恢复 origin_route 实例与实体参数'
}
