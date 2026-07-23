import { Modal } from "./Modal";
import styles from "./AboutModal.module.css";
import bilibiliIcon from "../../assets/Bilibili.svg";
import githubIcon from "../../assets/GitHub_Invertocat_Black.svg";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const changeLogs = [
    "v1.1.0: 架构更新",
    "v1.0.0: 项目上线, 主要功能实时显示基频共振峰",
  ];
  return (
    <Modal open={open} title="关于" onClose={onClose}>
      <section className={styles.section}>
        <h4>项目信息</h4>
        <p>名称：在线声音训练「看见自己的声音」</p>
        <p>版本：1.1.0</p>
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
