// SPDX-License-Identifier: AGPL-3.0-or-later

package cmd

import (
	"runtime"

	"github.com/spf13/cobra"

	"github.com/fluxerapp/fluxer/fluxer_rexctl/internal/engine"
	"github.com/fluxerapp/fluxer/fluxer_rexctl/internal/instance"
)

type versionJSON struct {
	Version string  `json:"version"`
	Commit  string  `json:"commit"`
	Go      string  `json:"go"`
	OS      string  `json:"os"`
	Arch    string  `json:"arch"`
	Orvix  *string `json:"orvix"`

	MinPodman   string `json:"min_podman"`
	MinDocker   string `json:"min_docker"`
	StateSchema int    `json:"state_schema"`
}

func newVersionCmd(app *App) *cobra.Command {
	c := &cobra.Command{
		Use:   "version",
		Short: "Show the rexctl and Orvix versions",
		Args:  noArgs,
		RunE: func(c *cobra.Command, _ []string) error {
			v := versionJSON{Version: app.Version, Commit: app.Commit, Go: runtime.Version(), OS: runtime.GOOS, Arch: runtime.GOARCH,
				MinPodman: engine.MinPodman, MinDocker: engine.MinDocker, StateSchema: instance.StateSchema}
			if inst, err := app.Instance(); err == nil && inst.State != nil && inst.State.Release != "" {
				r := inst.State.Release
				v.Orvix = &r
			}
			if app.Flags.JSON {
				return app.UI.JSON(v)
			}
			app.UI.Result("rexctl " + v.Version)
			if v.Orvix != nil {
				app.UI.Result("Orvix " + *v.Orvix)
			}
			return nil
		},
	}
	app.jsonFlag(c)
	return c
}
