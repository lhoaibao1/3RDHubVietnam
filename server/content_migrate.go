package main

import (
	"context"
	"log"
)

// ensureNewProjects thêm vào nội dung đang chạy những dự án mặc định mới (vd. 3Credit) mà bản đã lưu trong CMS chưa có.
// Mỗi dự án chỉ thêm đúng một lần (đánh dấu trong kv), nên nếu sau đó bạn xoá nó trong CMS thì sẽ không tự hiện lại.
func (a *App) ensureNewProjects(ctx context.Context) {
	def, err := loadDefaults()
	if err != nil {
		return
	}
	c, _, err := a.currentContent(ctx)
	if err != nil || len(c.Product.Projects) == 0 { // chưa có dự án nào lưu: giao diện dùng mặc định, đã có sẵn dự án mới
		return
	}
	var added []string
	for _, id := range []string{"3credit"} {
		var done bool
		if ok, _ := kvGet(ctx, a.pool, "mig_project_"+id, &done); ok && done {
			continue
		}
		has := false
		for _, p := range c.Product.Projects {
			if p.ID == id {
				has = true
			}
		}
		if !has {
			for _, p := range def.Product.Projects {
				if p.ID == id {
					c.Product.Projects = append(c.Product.Projects, p)
					added = append(added, p.Name.VI)
				}
			}
		}
		_ = kvSetPool(ctx, a.pool, "mig_project_"+id, true)
	}
	if len(added) == 0 {
		return
	}
	if err := a.saveContent(ctx, c, "Thêm dự án mới vào trang Sản phẩm: "+added[0]); err != nil {
		log.Printf("thêm dự án mới: %v", err)
	}
}
