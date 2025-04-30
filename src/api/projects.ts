export const createProjectApi = (fetcher: typeof fetch) => ({
	checkProjectExists: async (project: string) => {
		const res = await fetcher(`/api/public/v0/project/${project}`)
		return res.ok
	},
})
