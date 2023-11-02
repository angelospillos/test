import { EyeIcon, ArrowLeftIcon } from '@angelos/core/theme/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import AddMultipleSwitch from '~/components/AddMultipleSwitch';
import IconButton from '~/components/IconButton';

import { Headline, BackButton } from '../../OverlayMenu.styled';

import { Content } from './AssertMenu.styled';

const AssertMenu = ({ onBackClick, onMulitpleChange, multiple }) => {
  const { t } = useTranslation();

  return (
    <>
      <Headline>
        <IconButton onClick={onBackClick}>
          <ArrowLeftIcon />
        </IconButton>
        {t('assertMenu.title', 'Assert')}
      </Headline>
      <Content>
        <EyeIcon />
        {t('assertMenu.decription', 'Click any element on the page to record an assertion')}
        <AddMultipleSwitch
          value={multiple}
          onChange={onMulitpleChange}
          tooltip={t(
            'assertMenu.switchTooltip',
            'Keep the assertion mode active after clicking. Turn this on if you want to add many assertions.',
          )}
        />
        <BackButton onClick={onBackClick}>{t('assertMenu.back', 'Go back')}</BackButton>
      </Content>
    </>
  );
};

export default AssertMenu;
