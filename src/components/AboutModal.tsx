import { Modal } from "./Modal";
import styles from "./AboutModal.module.css";
import bilibiliIcon from "../../assets/Bilibili.svg";
import githubIcon from "../../assets/GitHub_Invertocat_Black.svg";
import pkg from "../../package.json";
import { useSyncExternalStore } from 'react';
import { getAnalyticsDisabled, isAnalyticsStorageAvailable, setAnalyticsDisabled, subscribeAnalyticsPreference } from '../analytics/analytics';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const analyticsDisabled = useSyncExternalStore(subscribeAnalyticsPreference, getAnalyticsDisabled);
  const storageAvailable = useSyncExternalStore(subscribeAnalyticsPreference, isAnalyticsStorageAvailable);
  const doNotTrack = navigator.doNotTrack === '1';
  const changeLogs = [
    "v1.1.0: 架构更新",
    "v1.0.0: 项目上线, 主要功能实时显示基频共振峰",
  ];
  return (
    <Modal open={open} title="关于" onClose={onClose}>
      <section className={styles.section}>
        <h4>项目信息</h4>
        <p>名称：在线声音训练「看见自己的声音」</p>
        <p>版本：{pkg.version}</p>
      </section>

      <section className={styles.section}>
        <h4>使用统计</h4>
        <p id="analytics-description">用于了解页面访问和功能使用情况。录音和声音分析数据只在本机处理，不发送给统计服务。过渡期使用 Umami 和 Vercel Analytics。</p>
        <p>统计包含浏览器、设备、语言、屏幕尺寸及粗略地区等访问信息。</p>
        <label className={styles.analyticsControl}>
          <input type="checkbox" checked={!analyticsDisabled && !doNotTrack} disabled={doNotTrack}
            aria-describedby="analytics-description" onChange={event => setAnalyticsDisabled(!event.currentTarget.checked)} />
          <span>匿名使用统计</span>
        </label>
        <p>{doNotTrack ? '浏览器的 Do Not Track 设置已关闭统计。' : '开关立即生效，关闭不会影响当前录音。'}</p>
        {!storageAvailable && <p role="status">当前浏览器无法保存偏好，本次设置已生效，刷新后可能需要重新设置。</p>}
      </section>

      <section className={styles.section}>
        <h4>仓库地址</h4>
        <p>
          <a
            className={styles.link}
            href="https://github.com/JPs-git/voice-builder"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://github.com/JPs-git/voice-builder
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h4>更新日志</h4>
        {changeLogs.map((log, i) => (
          <p key={i}>{log}</p>
        ))}
      </section>

      <section className={styles.section}>
        <h4>联系作者</h4>
        <p>
          <a className={styles.link} href="mailto:2495413242@qq.com">
            2495413242@qq.com
          </a>
        </p>
        <div className={styles.contactIcons}>
          <a
            href="https://space.bilibili.com/13501493"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={bilibiliIcon}
              alt="Bilibili"
              title="关注星弧破碎喵!关注星弧破碎谢谢喵!"
              className={styles.icon}
            />
          </a>
          <a
            href="https://github.com/JPs-git"
            target="_blank"
            title="觉得有帮助欢迎star!"
            rel="noopener noreferrer"
          >
            <img src={githubIcon} alt="GitHub" className={styles.icon} />
          </a>
        </div>
      </section>
    </Modal>
  );
}
