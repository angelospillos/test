import { RadioButton, IconButton, CopyButton } from '@angelos/core/components';
import { ArrowLeftIcon, OpenWindowIcon } from '@angelos/core/theme/icons';
import dayjs from 'dayjs';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { RecorderActions } from '~/modules/recorder/recorder.redux';
import { selectRecordingProjectSlug } from '~/modules/recorder/recorder.selectors';

import { BackButton, PrimaryButton } from '../../OverlayMenu.styled';

import { Content, Headline, Input, RadioButtons, GeneratedEmail } from './InboxMenu.styled';

const InboxMenu = ({ onBackClick, testId, testRunId, windowId }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const projectSlug = useSelector(selectRecordingProjectSlug);
  const [shouldUseCustomId, setShouldUseCustomId] = React.useState(false);
  const [customId, setCustomId] = React.useState(false);
  const inboxId = customId || testRunId || testId;

  const accountName = shouldUseCustomId ? customId : inboxId;

  const generatedEmail = `${accountName}@${process.env.INBOX_DOMAIN}`;

  const handleOpenInbox = useCallback(() => {
    dispatch(
      RecorderActions.openNewTabWithUrlRequested(
        windowId,
        `${process.env.INBOX_URL}/${accountName}/`,
      ),
    );
  }, [dispatch, accountName, windowId]);

  const handleIdTypeChange = (event) => {
    const useCustomId = event.target.value === 'true';
    setShouldUseCustomId(useCustomId);
    setCustomId(
      useCustomId
        ? [
            t('inboxMenu.defaultCustomId', 'automation-testing'),
            projectSlug,
            dayjs().format('mmss'),
          ]
            .filter(Boolean)
            .join('-')
        : '',
    );
  };

  const handleCustomIdChange = (event) => {
    setCustomId(event.target.value);
  };

  return (
    <>
      <Headline>
        <IconButton onClick={onBackClick}>
          <ArrowLeftIcon />
        </IconButton>
        {t('inboxMenu.title', 'Open inbox for a special testing email address')}
      </Headline>
      <Content>
        <RadioButtons>
          <RadioButton
            name="mailId"
            onChange={handleIdTypeChange}
            value="false"
            checked={!shouldUseCustomId}
          >
            {t('inboxMenu.randomId', 'Auto-generated random email unique for this test')}
          </RadioButton>
          <RadioButton
            name="mailId"
            onChange={handleIdTypeChange}
            value="true"
            checked={shouldUseCustomId}
          >
            {t('inboxMenu.customId', 'Specific test email')}
          </RadioButton>
        </RadioButtons>

        <GeneratedEmail>
          {shouldUseCustomId && <Input onChange={handleCustomIdChange} value={customId} />}
          <div>
            <span>{generatedEmail}</span>
            <CopyButton value={generatedEmail} small />
          </div>
        </GeneratedEmail>
        <PrimaryButton onClick={handleOpenInbox} Icon={OpenWindowIcon} disabled={!accountName}>
          {t('inboxMenu.openInbox', 'Open inbox')}
        </PrimaryButton>
        <BackButton onClick={onBackClick}>{t('inboxMenu.back', 'Go back')}</BackButton>
      </Content>
    </>
  );
};

export default InboxMenu;
