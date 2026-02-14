import * as vue from 'vue';

/**
 * Composant Vue 3 pour le bouton Accès immédiat Nolink
 */
/**
 * Bouton "Accès immédiat" pour Vue 3
 */
declare const NolinkAccessButton: vue.DefineComponent<vue.ExtractPropTypes<{
    serviceId: {
        type: StringConstructor;
        required: true;
    };
    buttonText: StringConstructor;
    planId: StringConstructor;
    color: StringConstructor;
}>, () => vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, vue.PublicProps, Readonly<vue.ExtractPropTypes<{
    serviceId: {
        type: StringConstructor;
        required: true;
    };
    buttonText: StringConstructor;
    planId: StringConstructor;
    color: StringConstructor;
}>> & Readonly<{}>, {}, {}, {}, {}, string, vue.ComponentProvideOptions, true, {}, any>;

export { NolinkAccessButton };
