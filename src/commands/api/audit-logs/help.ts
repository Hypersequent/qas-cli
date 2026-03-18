import { apiDocsEpilog } from '../utils'

export default {
	list: {
		command: 'List audit log entries.',
		after: 'Cursor for pagination. Returns events with ID greater than this value.',
		count: 'Number of events to return per page. Must be between 1 and 1000. Omit to use default.',
		epilog: apiDocsEpilog('audit_logs', 'list-audit-logs'),
	},
} as const
