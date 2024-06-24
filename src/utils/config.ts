export const getApiUrl = (subdomain: string, zone: string) =>
	`https://${subdomain}.${zone}.qasphere.com`

export const REQUIRED_NODE_VERSION = '20.0.0' // lts/iron
