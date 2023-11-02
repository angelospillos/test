import { HoverIcon, ArrowLeftIcon } from '@angelos/core/theme/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import AddMultipleSwitch from '~/components/AddMultipleSwitch';
import IconButton from '~/components/IconButton';

import { Headline, BackButton } from '../../OverlayMenu.styled';

import { Content } from './HoverMenu.styled';

const HoverMenu = ({ onBackClick, onMulitpleChange, multiple }) => {
  const { t } = useTranslation();

  return (
    <>
      <Headline>
        <IconButton onClick={onBackClick}>
          <ArrowLeftIcon />
        </IconButton>
        {t('hoverMenu.title', 'Hover')}
      </Headline>
      <Content>
        <HoverIcon />
        {t('hoverMenu.decription', 'Click an element to record mouse hover over this element.')}
        <AddMultipleSwitch
          value={multiple}
          onChange={onMulitpleChange}
          tooltip={t(
            'hoverMenu.switchTooltip',
            'Record multiple consecutive hovers. Useful for recording mouseover menus.',
          )}
        />
        <BackButton onClick={onBackClick}>{t('hoverMenu.back', 'Go back')}</BackButton>
      </Content>
    </>
  );
};

export default HoverMenu;
