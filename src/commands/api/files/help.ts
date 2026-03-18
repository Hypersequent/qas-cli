import { apiDocsEpilog } from '../utils'

export default {
	upload: {
		command: 'Upload a file attachment.',
		file: `Path to the file to upload.`,
		epilog: apiDocsEpilog('upload_file', 'upload-file'),
	},

	examples: [
		{
			usage: '$0 api files upload --file ./screenshot.png',
			description: 'Upload a file attachment',
		},
	],
} as const
