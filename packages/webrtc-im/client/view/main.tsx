import type { FC } from "react";
import { Fragment } from "react";
import styles from "../styles/main.m.scss";
import { TabBar } from "./tab-bar";
import { Contacts } from "./contacts";
import { Message } from "./message";
import { cs } from "@block-kit/utils";
import { useIsMobile } from "../hooks/use-is-mobile";

export const Main: FC = () => {
  const { isMobile } = useIsMobile();

  return (
    <Fragment>
      <div className={cs(styles.main, isMobile && "webrtc-im-mobile")}>
        <TabBar></TabBar>
        <Contacts></Contacts>
        <Message></Message>
      </div>
    </Fragment>
  );
};
