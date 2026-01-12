/**
 * static/js/components/importModal.js
 * URL 导入组件
 */

import { importCardFromUrl } from '../api/card.js';

export default function importModal() {
    return {
        // === 本地状态 ===
        showImportUrlModal: false,
        importUrlInput: '',
        importTargetCategory: '', // 默认为空，表示根目录或跟随视图

        get allFoldersList() { 
            return this.$store.global.allFoldersList; 
        },

        init() {
            // 监听打开事件
            // 通常由 Header 触发
            window.addEventListener('open-import-url', (e) => {
                // 可以接收默认分类
                this.importTargetCategory = e.detail && e.detail.category ? e.detail.category : '';
                this.importUrlInput = '';
                this.showImportUrlModal = true;
            });
        },

        importFromUrl() {
            if (!this.importUrlInput.trim()) {
                alert("请输入 URL");
                return;
            }

            this.$store.global.isLoading = true;

            // 如果用户未选择分类，则逻辑上应该跟随当前视图
            // 但组件无法直接访问 Layout 的 filterCategory，
            // 建议在 'open-import-url' 事件中传入当前 filterCategory 作为默认值
            
            importCardFromUrl({
                url: this.importUrlInput.trim(),
                category: this.importTargetCategory
            })
            .then(res => {
                this.$store.global.isLoading = false;
                
                if (res.success) {
                    this.showImportUrlModal = false;
                    this.importUrlInput = '';
                    
                    // 刷新列表
                    window.dispatchEvent(new CustomEvent('refresh-card-list'));
                    
                    // 插入新卡片的高亮提示 (逻辑在 grid 中处理了，这里只负责弹窗)
                    // 如果 new_card 存在，可以触发高亮
                    if (res.new_card) {
                        window.dispatchEvent(new CustomEvent('highlight-card', { detail: res.new_card.id }));
                        
                        // 提示
                        const target = this.importTargetCategory || '当前目录';
                        if (confirm(`导入成功：${res.new_card.char_name}\n保存位置: "${target}"\n是否查看详情？`)) {
                            window.dispatchEvent(new CustomEvent('open-detail', { detail: res.new_card }));
                        }
                    }
                } else {
                    alert("导入失败: " + res.msg);
                }
            })
            .catch(err => {
                this.$store.global.isLoading = false;
                alert("网络请求错误: " + err);
            });
        }
    }
}